import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import { createServer } from "../../framework/runtime/server";
import { createFixtureApp } from "../helpers/fixture-app";
import { createTempDirRegistry } from "../helpers/temp-dir";

const tempDirs = createTempDirRegistry();

afterEach(async () => {
  await tempDirs.cleanup();
  delete (globalThis as { __rbssrHookOrder?: string[] }).__rbssrHookOrder;
  delete (globalThis as { __rbssrHookPhases?: string[] }).__rbssrHookPhases;
});

describe("server lifecycle hooks", () => {
  it("fires onCatch from route -> layout -> root with the loader phase", async () => {
    const runtimeImport = "react-bun-ssr/route";
    const root = await createFixtureApp(tempDirs, {
      "app/root.tsx": `
        import { Outlet } from "${runtimeImport}";
        export default function Root(){ return <main><Outlet /></main>; }
        export async function onCatch(ctx) {
          const g = globalThis;
          g.__rbssrHookOrder ??= [];
          g.__rbssrHookPhases ??= [];
          g.__rbssrHookOrder.push("root");
          g.__rbssrHookPhases.push(ctx.phase);
        }
      `,
      "app/routes/admin/_layout.tsx": `
        import { Outlet } from "${runtimeImport}";
        export default function AdminLayout(){ return <section><Outlet /></section>; }
        export async function onCatch(ctx) {
          const g = globalThis;
          g.__rbssrHookOrder ??= [];
          g.__rbssrHookOrder.push("layout");
        }
      `,
      "app/routes/admin/caught.tsx": `
        import { routeError } from "${runtimeImport}";
        export function loader(){ return routeError(418, { reason: "teapot" }); }
        export function onCatch(ctx) {
          const g = globalThis;
          g.__rbssrHookOrder ??= [];
          g.__rbssrHookOrder.push("route");
        }
        export function CatchBoundary(){ return <h1>caught</h1>; }
        export default function Caught(){ return <p>never</p>; }
      `,
    }, "rbssr-server-hooks-catch");

    const server = createServer({ appDir: path.join(root, "app"), mode: "development" });
    const response = await server.fetch(new Request("http://localhost/admin/caught"));

    expect(response.status).toBe(418);
    expect((globalThis as { __rbssrHookOrder?: string[] }).__rbssrHookOrder).toEqual([
      "route",
      "layout",
      "root",
    ]);
    expect((globalThis as { __rbssrHookPhases?: string[] }).__rbssrHookPhases).toEqual(["loader"]);
  });

  it("fires onError from route -> layout -> root with the loader phase", async () => {
    const runtimeImport = "react-bun-ssr/route";
    const root = await createFixtureApp(tempDirs, {
      "app/root.tsx": `
        import { Outlet } from "${runtimeImport}";
        export default function Root(){ return <main><Outlet /></main>; }
        export async function onError(ctx) {
          const g = globalThis;
          g.__rbssrHookOrder ??= [];
          g.__rbssrHookPhases ??= [];
          g.__rbssrHookOrder.push("root");
          g.__rbssrHookPhases.push(ctx.phase);
        }
      `,
      "app/routes/admin/_layout.tsx": `
        import { Outlet } from "${runtimeImport}";
        export default function AdminLayout(){ return <section><Outlet /></section>; }
        export async function onError() {
          const g = globalThis;
          g.__rbssrHookOrder ??= [];
          g.__rbssrHookOrder.push("layout");
        }
      `,
      "app/routes/admin/error.tsx": `
        export function loader(){ throw new Error("boom"); }
        export function onError() {
          const g = globalThis;
          g.__rbssrHookOrder ??= [];
          g.__rbssrHookOrder.push("route");
        }
        export function ErrorBoundary(){ return <h1>errored</h1>; }
        export default function ErrorRoute(){ return <p>never</p>; }
      `,
    }, "rbssr-server-hooks-error");

    const server = createServer({ appDir: path.join(root, "app"), mode: "development" });
    const response = await server.fetch(new Request("http://localhost/admin/error"));

    expect(response.status).toBe(500);
    expect((globalThis as { __rbssrHookOrder?: string[] }).__rbssrHookOrder).toEqual([
      "route",
      "layout",
      "root",
    ]);
    expect((globalThis as { __rbssrHookPhases?: string[] }).__rbssrHookPhases).toEqual(["loader"]);
  });
});
