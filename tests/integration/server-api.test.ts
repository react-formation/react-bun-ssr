import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import { createServer } from "../../framework/runtime/server";
import { createFixtureApp } from "../helpers/fixture-app";
import { createTempDirRegistry } from "../helpers/temp-dir";

const tempDirs = createTempDirRegistry();

afterEach(async () => {
  await tempDirs.cleanup();
});

describe("server API contracts", () => {
  it("handles JSON results, redirects, 405 responses, route errors, uncaught errors, and HEAD", async () => {
    const routeApiImport = Bun.pathToFileURL(
      path.join(process.cwd(), "framework/runtime/route-api.ts"),
    ).toString();
    const root = await createFixtureApp(tempDirs, {
      "app/root.tsx": `export default function Root(){ return <main />; }`,
      "app/middleware.ts": `
        export default async function middleware(ctx, next) {
          ctx.locals.viewer = "alice";
          return next();
        }
      `,
      "app/routes/api/hello.ts": `
        export function GET(ctx){ return { ok: true, viewer: ctx.locals.viewer }; }
      `,
      "app/routes/api/redirect.ts": `
        import { redirect } from "${routeApiImport}";
        export function GET(){ return redirect("/docs"); }
      `,
      "app/routes/api/error.ts": `
        import { routeError } from "${routeApiImport}";
        export function GET(){ throw routeError(418, { reason: "teapot" }); }
      `,
      "app/routes/api/boom.ts": `
        export const phases = [];
        export function onError(ctx){ phases.push(ctx.phase); }
        export function GET(){ throw new Error("boom"); }
      `,
      "app/routes/api/head.ts": `
        export function GET(){ return { ok: true }; }
        export function HEAD(){ return new Response(null, { status: 204, headers: { "x-head": "1" } }); }
      `,
    }, "rbssr-server-api");

    const server = createServer({
      appDir: path.join(root, "app"),
      mode: "development",
    });

    const helloResponse = await server.fetch(new Request("http://localhost/api/hello"));
    expect(helloResponse.status).toBe(200);
    expect(await helloResponse.json()).toEqual({ ok: true, viewer: "alice" });

    const redirectResponse = await server.fetch(new Request("http://localhost/api/redirect"));
    expect(redirectResponse.status).toBe(302);
    expect(redirectResponse.headers.get("location")).toBe("/docs");

    const methodResponse = await server.fetch(
      new Request("http://localhost/api/hello", { method: "POST" }),
    );
    expect(methodResponse.status).toBe(405);
    expect(methodResponse.headers.get("allow")).toContain("GET");

    const routeErrorResponse = await server.fetch(new Request("http://localhost/api/error"));
    expect(routeErrorResponse.status).toBe(418);
    expect(await routeErrorResponse.json()).toEqual({ reason: "teapot" });

    const boomResponse = await server.fetch(new Request("http://localhost/api/boom"));
    expect(boomResponse.status).toBe(500);
    expect(await boomResponse.json()).toEqual({ error: "boom" });

    const boomModule = await import(Bun.pathToFileURL(path.join(root, "app/routes/api/boom.ts")).toString());
    expect(boomModule.phases).toEqual(["api"]);

    const headResponse = await server.fetch(new Request("http://localhost/api/head", { method: "HEAD" }));
    expect(headResponse.status).toBe(204);
    expect(headResponse.headers.get("x-head")).toBe("1");
    expect(await headResponse.text()).toBe("");
  });
});
