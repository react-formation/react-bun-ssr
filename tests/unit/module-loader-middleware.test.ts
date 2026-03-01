import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import {
  extractRouteMiddleware,
  loadGlobalMiddleware,
  loadNestedMiddleware,
  loadRouteModule,
} from "../../framework/runtime/module-loader";
import type { Middleware } from "../../framework/runtime/types";
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
});
