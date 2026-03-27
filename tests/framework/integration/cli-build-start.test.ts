import path from "node:path";
import { afterEach, describe, expect, it, setDefaultTimeout } from "bun:test";
import { runInit, runStart } from "../../../framework/cli/commands";
import { existsPath, readText, writeText } from "../../../framework/runtime/io";
import { createFixtureApp } from "../helpers/fixture-app";
import { canListenOnLoopback, getAvailablePort, runProcess, spawnProcess, waitForHttpReady } from "../helpers/process";
import { createTempDirRegistry } from "../helpers/temp-dir";

const tempDirs = createTempDirRegistry();
const rbssrBinPath = path.resolve(import.meta.dir, "../../../bin/rbssr.ts");
let activeProcess: Bun.Subprocess | null = null;
const describeWhenLoopback = (await canListenOnLoopback()) ? describe : describe.skip;

setDefaultTimeout(40_000);

afterEach(async () => {
  if (activeProcess) {
    activeProcess.kill();
    await activeProcess.exited;
    activeProcess = null;
  }

  await tempDirs.cleanup();
});

describeWhenLoopback("CLI build/start contracts", () => {
  it("scaffolds a new app with init", async () => {
    const root = await tempDirs.create("rbssr-cli-init");

    await runInit([], root);

    for (const relativePath of [
      "package.json",
      "tsconfig.json",
      ".gitignore",
      "rbssr.config.ts",
      "app/root.tsx",
      "app/root.module.css",
      "app/middleware.ts",
      "app/public/favicon.svg",
      "app/routes/index.tsx",
      "app/routes/api/health.ts",
    ]) {
      expect(await existsPath(path.join(root, relativePath))).toBe(true);
    }

    const generatedPackage = JSON.parse(await readText(path.join(root, "package.json"))) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const frameworkPackage = await Bun.file("package.json").json() as {
      version?: string;
    };

    expect(generatedPackage.scripts).toEqual({
      dev: "rbssr dev",
      build: "rbssr build",
      start: "rbssr start",
      typecheck: "bunx tsc --noEmit",
    });
    expect(generatedPackage.dependencies?.["react-bun-ssr"]).toBe(frameworkPackage.version);
    expect(generatedPackage.dependencies?.react).toBe("^19");
    expect(generatedPackage.dependencies?.["react-dom"]).toBe("^19");
    expect(generatedPackage.devDependencies?.typescript).toBeDefined();
    expect(generatedPackage.devDependencies?.["bun-types"]).toBeDefined();
  });

  it("adds missing starter files without overwriting existing files unless forced", async () => {
    const root = await tempDirs.create("rbssr-cli-init-merge");
    const packageJsonPath = path.join(root, "package.json");
    const customPackageJson = `${JSON.stringify({
      name: "custom-app",
      private: true,
      scripts: {
        dev: "custom-dev",
      },
    }, null, 2)}\n`;

    await writeText(packageJsonPath, customPackageJson);

    await runInit([], root);

    expect(await readText(packageJsonPath)).toBe(customPackageJson);
    expect(await existsPath(path.join(root, "tsconfig.json"))).toBe(true);
    expect(await existsPath(path.join(root, ".gitignore"))).toBe(true);
    expect(await existsPath(path.join(root, "app/public/favicon.svg"))).toBe(true);

    await runInit(["--force"], root);

    const generatedPackage = JSON.parse(await readText(packageJsonPath)) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
    };

    expect(generatedPackage.scripts?.dev).toBe("rbssr dev");
    expect(generatedPackage.dependencies?.["react-bun-ssr"]).toBeDefined();
  });

  it("builds client and server artifacts with a package-safe server entrypoint", async () => {
    const port = await getAvailablePort();
    const root = await createFixtureApp(tempDirs, {
      "rbssr.config.ts": `
        export default { appDir: "app", port: ${port} };
      `,
      "app/root.tsx": `
        import { Outlet } from "react-bun-ssr/route";
        export default function Root(){ return <main><Outlet /></main>; }
      `,
      "app/routes/index.tsx": `export default function Index(){ return <h1>home</h1>; }`,
      "app/public/logo.txt": "logo",
    }, "rbssr-cli-build");

    const buildResult = await runProcess({
      cmd: ["bun", rbssrBinPath, "build"],
      cwd: root,
    });
    if (buildResult.exitCode !== 0) {
      throw new Error(`rbssr build failed:\n${buildResult.stderr || buildResult.stdout}`);
    }

    expect(await existsPath(path.join(root, "dist/manifest.json"))).toBe(true);
    expect(await existsPath(path.join(root, "dist/server/server.mjs"))).toBe(true);
    expect(await existsPath(path.join(root, "dist/client/logo.txt"))).toBe(true);

    const manifest = JSON.parse(await readText(path.join(root, "dist/manifest.json"))) as {
      routes: Record<string, { script: string; css: string[] }>;
    };
    expect(manifest.routes.index).toBeDefined();
    expect(manifest.routes.index!.script.startsWith("/client/")).toBe(true);

    const serverEntry = await readText(path.join(root, "dist/server/server.mjs"));
    expect(serverEntry).toContain('from "react-bun-ssr"');
    expect(serverEntry).not.toContain("../../../framework/runtime/index.ts");
  });

  it("forces production builds even when NODE_ENV is development", async () => {
    const port = await getAvailablePort();
    const root = await createFixtureApp(tempDirs, {
      "rbssr.config.ts": `
        export default { appDir: "app", port: ${port} };
      `,
      "app/root.tsx": `
        import { Outlet } from "react-bun-ssr/route";
        export default function Root(){ return <main><Outlet /></main>; }
      `,
      "app/routes/index.tsx": `
        export default function Index(){ return <h1>{process.env.NODE_ENV}</h1>; }
        export function head(){ return <title>{process.env.NODE_ENV}</title>; }
      `,
    }, "rbssr-cli-build-prod");

    const buildResult = await runProcess({
      cmd: ["bun", rbssrBinPath, "build"],
      cwd: root,
      env: {
        NODE_ENV: "development",
      },
    });

    if (buildResult.exitCode !== 0) {
      throw new Error(`rbssr build failed:\n${buildResult.stderr || buildResult.stdout}`);
    }

    const manifest = JSON.parse(await readText(path.join(root, "dist/manifest.json"))) as {
      routes: Record<string, { script: string; css: string[] }>;
    };

    expect(manifest.routes.index).toBeDefined();
    expect(manifest.routes.index!.script).toMatch(/^\/client\/route__index-[A-Za-z0-9]+\.(?:js|mjs)$/);

    activeProcess = spawnProcess({
      cmd: ["bun", rbssrBinPath, "start"],
      cwd: root,
      env: {
        NODE_ENV: "development",
      },
      stdout: "pipe",
      stderr: "pipe",
    });

    const baseUrl = `http://127.0.0.1:${port}`;
    await waitForHttpReady(baseUrl, { timeoutMs: 45_000, process: activeProcess });

    const html = await fetch(`${baseUrl}/`).then(response => response.text());
    expect(html).toContain("<title>production</title>");
    expect(html).toContain(">production</h1>");
  });

  it("builds and starts apps that use *.server route companions and api handlers", async () => {
    const port = await getAvailablePort();
    const root = await createFixtureApp(tempDirs, {
      "rbssr.config.ts": `
        export default { appDir: "app", port: ${port} };
      `,
      "app/root.tsx": `
        import { Outlet } from "react-bun-ssr/route";
        export default function Root(){ return <main><Outlet /></main>; }
      `,
      "app/middleware.server.ts": `
        export default async function middleware(ctx, next) {
          ctx.locals.viewer = "alice";
          return next();
        }
      `,
      "app/routes/index.tsx": `
        import { useLoaderData } from "react-bun-ssr/route";
        export default function Index(){
          const data = useLoaderData<{ message: string; viewer: string }>();
          return <h1>{data.message}:{data.viewer}</h1>;
        }
      `,
      "app/routes/index.server.tsx": `
        import { Database } from "bun:sqlite";
        const db = new Database(":memory:");
        db.exec("create table if not exists posts (id integer primary key autoincrement, title text);");
        db.exec("insert into posts (title) values ('hello');");
        export function loader(ctx){
          const row = db.query("select title from posts limit 1").get();
          return { message: String(row?.title ?? "missing"), viewer: String(ctx.locals.viewer ?? "missing") };
        }
      `,
      "app/routes/api/session.server.ts": `
        export function GET(ctx){ return { ok: true, viewer: ctx.locals.viewer }; }
      `,
    }, "rbssr-cli-build-server-only");

    const buildResult = await runProcess({
      cmd: ["bun", rbssrBinPath, "build"],
      cwd: root,
    });
    if (buildResult.exitCode !== 0) {
      throw new Error(`rbssr build failed:\n${buildResult.stderr || buildResult.stdout}`);
    }

    activeProcess = spawnProcess({
      cmd: ["bun", rbssrBinPath, "start"],
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
    });

    const baseUrl = `http://127.0.0.1:${port}`;
    await waitForHttpReady(baseUrl, { timeoutMs: 60_000, process: activeProcess });

    const pageHtml = await fetch(`${baseUrl}/`).then(response => response.text());
    expect(pageHtml.replaceAll("<!-- -->", "")).toContain("hello:alice");

    const apiJson = await fetch(`${baseUrl}/api/session`).then(response => response.json());
    expect(apiJson).toEqual({ ok: true, viewer: "alice" });
  });

  it("throws a clear error when start runs before build", async () => {
    const root = await createFixtureApp(tempDirs, {
      "rbssr.config.ts": `
        export default { appDir: "app" };
      `,
      "app/root.tsx": `export default function Root(){ return <main />; }`,
      "app/routes/index.tsx": `export default function Index(){ return <h1>home</h1>; }`,
    }, "rbssr-cli-start");

    await expect(runStart(root)).rejects.toThrow("Missing dist/server/server.mjs");
  });
});
