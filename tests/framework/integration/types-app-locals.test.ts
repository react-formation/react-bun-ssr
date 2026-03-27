import path from "node:path";
import { afterEach, describe, expect, it, setDefaultTimeout } from "bun:test";
import { createFixtureApp } from "../helpers/fixture-app";
import { runProcess } from "../helpers/process";
import { createTempDirRegistry } from "../helpers/temp-dir";

const tempDirs = createTempDirRegistry();

setDefaultTimeout(20_000);

afterEach(async () => {
  await tempDirs.cleanup();
});

describe("typed AppRouteLocals", () => {
  it("supports root-module augmentation across middleware, loaders, actions, and request contexts", async () => {
    const root = await createFixtureApp(tempDirs, {
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "Bundler",
          jsx: "react-jsx",
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          types: ["bun-types"],
        },
        include: ["app/**/*.ts", "app/**/*.d.ts"],
      }, null, 2),
      "app/types.d.ts": `
        declare module "react-bun-ssr" {
          interface AppRouteLocals {
            auth: { userId: string; role: "member" | "admin" } | null;
          }
        }
      `,
      "app/routes/typecheck.ts": `
        import type {
          Action,
          Loader,
          Middleware,
          RequestContext,
        } from "react-bun-ssr/route";

        export const middleware: Middleware = async (ctx, next) => {
          ctx.locals.auth = { userId: "u_1", role: "member" };
          return next();
        };

        export const loader: Loader = (ctx) => {
          return { userId: ctx.locals.auth?.userId ?? null };
        };

        export const action: Action = (ctx) => {
          return { role: ctx.locals.auth?.role ?? null };
        };

        export function readInApi(ctx: RequestContext) {
          return ctx.locals.auth?.userId ?? null;
        }

        // @ts-expect-error missingKey should remain unknown even with locals augmentation.
        const invalid = ({} as RequestContext).locals.missingKey.deep;
        void invalid;
      `,
    }, "rbssr-types-locals");

    const bunTypesSource = path.resolve(process.cwd(), "node_modules/bun-types");
    const bunTypesLink = path.join(root, "node_modules/bun-types");
    const linkResult = Bun.spawnSync({
      cmd: ["ln", "-s", bunTypesSource, bunTypesLink],
      stdout: "pipe",
      stderr: "pipe",
    });
    if (linkResult.exitCode !== 0) {
      const stderr = new TextDecoder().decode(linkResult.stderr).trim();
      throw new Error(`Failed to link bun-types into fixture app: ${stderr || linkResult.exitCode}`);
    }

    const tscPath = Bun.resolveSync("typescript/bin/tsc", process.cwd());
    const result = await runProcess({
      cmd: ["bun", tscPath, "--project", path.join(root, "tsconfig.json"), "--noEmit"],
      cwd: root,
    });

    if (result.exitCode !== 0) {
      throw new Error(`Typecheck failed:\n${result.stderr || result.stdout}`);
    }

    expect(result.exitCode).toBe(0);
  });
});
