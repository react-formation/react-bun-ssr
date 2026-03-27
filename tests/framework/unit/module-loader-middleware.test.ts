import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import {
  extractRouteMiddleware,
  loadGlobalMiddleware,
  loadNestedMiddleware,
  loadRouteModule,
} from "../../../framework/runtime/module-loader";
import type { Middleware } from "../../../framework/runtime/types";
import { createFixtureApp } from "../helpers/fixture-app";
import { createTempDirRegistry } from "../helpers/temp-dir";

const tempDirs = createTempDirRegistry();

afterEach(async () => {
  await tempDirs.cleanup();
});

describe("module loader middleware normalization", () => {
  it("loads default and named global middleware in order", async () => {
    const root = await createFixtureApp(tempDirs, {
      "app/middleware.ts": `
        export default async function defaultMiddleware(ctx, next) {
          return next();
        }
        export async function middleware(ctx, next) {
          return next();
        }
      `,
    }, "rbssr-module-loader-global");

    const middleware = await loadGlobalMiddleware(path.join(root, "app/middleware.ts"), "global-order");
    expect(middleware).toHaveLength(2);
    expect(middleware.every(entry => typeof entry === "function")).toBe(true);
  });

  it("preserves nested middleware file order and ignores invalid exports", async () => {
    const root = await createFixtureApp(tempDirs, {
      "app/routes/_middleware.ts": `
        export default async function rootMiddleware(ctx, next) { return next(); }
        export const middleware = ["skip", async function rootNamed(ctx, next) { return next(); }];
      `,
      "app/routes/tasks/_middleware.ts": `
        export const middleware = async function tasksNamed(ctx, next) { return next(); };
        export default 123;
      `,
    }, "rbssr-module-loader-nested");

    const middleware = await loadNestedMiddleware([
      path.join(root, "app/routes/_middleware.ts"),
      path.join(root, "app/routes/tasks/_middleware.ts"),
    ], "nested-order");

    expect(middleware).toHaveLength(3);
    expect(middleware.every(entry => typeof entry === "function")).toBe(true);
  });

  it("preserves route module middleware array order", () => {
    const first: Middleware = async (_ctx, next) => next();
    const second: Middleware = async (_ctx, next) => next();

    expect(
      extractRouteMiddleware({
        default: () => null,
        middleware: [first, second],
      }),
    ).toEqual([first, second]);
  });

  it("throws a clear error when a route module default export is invalid", async () => {
    const root = await createFixtureApp(tempDirs, {
      "app/routes/broken.tsx": `export const loader = () => ({ ok: true });`,
    }, "rbssr-module-loader-broken");

    await expect(
      loadRouteModule(path.join(root, "app/routes/broken.tsx"), {
        serverBytecode: false,
        cacheBustKey: "broken-route",
      }),
    ).rejects.toThrow("must export a default React component");
  });

  it("merges server-only companion exports into the base route module", async () => {
    const root = await createFixtureApp(tempDirs, {
      "app/routes/index.tsx": `export default function Index(){ return null; }`,
      "app/routes/index.server.tsx": `
        export async function loader(){ return { ok: true }; }
      `,
    }, "rbssr-module-loader-companion");

    const moduleValue = await loadRouteModule(path.join(root, "app/routes/index.tsx"), {
      serverBytecode: false,
      cacheBustKey: "companion-route",
    });

    expect(typeof moduleValue.default).toBe("function");
    expect(typeof moduleValue.loader).toBe("function");
    expect(await moduleValue.loader?.({
      request: new Request("http://localhost/"),
      url: new URL("http://localhost/"),
      params: {},
      cookies: new Map(),
      locals: {},
      response: {
        headers: new Headers(),
        cookies: {
          get() {
            return undefined;
          },
          set() {
            return undefined;
          },
          delete() {
            return undefined;
          },
        },
      },
    } as never)).toEqual({ ok: true });
  });

  it("merges server-only companion exports when server bytecode interop adds a synthetic default namespace", async () => {
    const root = await createFixtureApp(tempDirs, {
      "app/routes/index.tsx": `export default function Index(){ return null; }`,
      "app/routes/index.server.tsx": `
        export function loader(){ return { ok: true }; }
      `,
    }, "rbssr-module-loader-companion-bytecode");

    const moduleValue = await loadRouteModule(path.join(root, "app/routes/index.tsx"), {
      serverBytecode: true,
      cacheBustKey: "companion-route-bytecode",
    });

    expect(typeof moduleValue.default).toBe("function");
    expect(typeof moduleValue.loader).toBe("function");
    expect(await moduleValue.loader?.({
      request: new Request("http://localhost/"),
      url: new URL("http://localhost/"),
      params: {},
      cookies: new Map(),
      locals: {},
      response: {
        headers: new Headers(),
        cookies: {
          get() {
            return undefined;
          },
          set() {
            return undefined;
          },
          delete() {
            return undefined;
          },
        },
      },
    } as never)).toEqual({ ok: true });
  });

  it("strips createRouteAction stubs from server-loaded route modules", async () => {
    const root = await createFixtureApp(tempDirs, {
      "app/routes/index.tsx": `
        import { createRouteAction } from "react-bun-ssr/route";
        export const action = createRouteAction<{ ok: boolean }>();
        export default function Index(){ return null; }
      `,
    }, "rbssr-module-loader-action-stub");

    const moduleValue = await loadRouteModule(path.join(root, "app/routes/index.tsx"), {
      serverBytecode: false,
      cacheBustKey: "action-stub-only",
    });

    expect(moduleValue.action).toBeUndefined();
  });

  it("allows createRouteAction stubs in base files when companion defines the server action", async () => {
    const root = await createFixtureApp(tempDirs, {
      "app/routes/index.tsx": `
        import { createRouteAction } from "react-bun-ssr/route";
        export const action = createRouteAction<{ ok: boolean }>();
        export default function Index(){ return null; }
      `,
      "app/routes/index.server.tsx": `
        export function action(){ return { ok: true }; }
      `,
    }, "rbssr-module-loader-action-stub-companion");

    const moduleValue = await loadRouteModule(path.join(root, "app/routes/index.tsx"), {
      serverBytecode: false,
      cacheBustKey: "action-stub-companion",
    });

    expect(typeof moduleValue.action).toBe("function");
    expect(await moduleValue.action?.({
      request: new Request("http://localhost/"),
      url: new URL("http://localhost/"),
      params: {},
      cookies: new Map(),
      locals: {},
      response: {
        headers: new Headers(),
        cookies: {
          get() {
            return undefined;
          },
          set() {
            return undefined;
          },
          delete() {
            return undefined;
          },
        },
      },
    } as never)).toEqual({ ok: true });
  });

  it("throws when route and companion define the same server export", async () => {
    const root = await createFixtureApp(tempDirs, {
      "app/routes/index.tsx": `
        export default function Index(){ return null; }
        export function loader(){ return { from: "base" }; }
      `,
      "app/routes/index.server.tsx": `
        export function loader(){ return { from: "server" }; }
      `,
    }, "rbssr-module-loader-companion-conflict");

    await expect(
      loadRouteModule(path.join(root, "app/routes/index.tsx"), {
        serverBytecode: false,
        cacheBustKey: "companion-conflict",
      }),
    ).rejects.toThrow("Duplicate server export");
  });

  it("loads app/middleware.server.ts when present and rejects plain/server collisions", async () => {
    const root = await createFixtureApp(tempDirs, {
      "app/middleware.server.ts": `
        export async function middleware(ctx, next) { return next(); }
      `,
    }, "rbssr-module-loader-global-server");

    const middleware = await loadGlobalMiddleware(path.join(root, "app/middleware.ts"), "global-server");
    expect(middleware).toHaveLength(1);

    const collisionRoot = await createFixtureApp(tempDirs, {
      "app/middleware.ts": `export default async function middleware(ctx, next){ return next(); }`,
      "app/middleware.server.ts": `export default async function middleware(ctx, next){ return next(); }`,
    }, "rbssr-module-loader-global-collision");

    await expect(
      loadGlobalMiddleware(path.join(collisionRoot, "app/middleware.ts"), "global-collision"),
    ).rejects.toThrow("Global middleware file collision");
  });
});
