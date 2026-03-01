import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import { createServer } from "../../framework/runtime/server";
import { createFixtureApp } from "../helpers/fixture-app";
import { createTempDirRegistry } from "../helpers/temp-dir";

const tempDirs = createTempDirRegistry();

afterEach(async () => {
  await tempDirs.cleanup();
});

function createDevAssets(routeIds: string[]) {
  return Object.fromEntries(
    routeIds.map(routeId => [
      routeId,
      {
        script: `/__rbssr/client/route__${routeId}.js`,
        css: ["/__rbssr/client/shared.css"],
      },
    ]),
  );
}

async function readTransitionLines(response: Response): Promise<Array<Record<string, unknown>>> {
  return (await response.text())
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line) as Record<string, unknown>);
}

describe("server transition contracts", () => {
  it("streams page, catch, error, and not-found initial chunks with deferred follow-ups", async () => {
    const runtimeImport = "react-bun-ssr/route";
    const root = await createFixtureApp(tempDirs, {
      "app/root.tsx": `
        import { Outlet } from "${runtimeImport}";
        export default function Root(){ return <main><Outlet /></main>; }
        export function NotFound(){ return <h1>root-missing</h1>; }
      `,
      "app/routes/index.tsx": `export default function Index(){ return <h1>home</h1>; }`,
      "app/routes/deferred.tsx": `
        import { defer } from "${runtimeImport}";
        export function loader(){ return defer({ slow: Promise.resolve("done") }); }
        export default function Deferred(){ return <h1>deferred</h1>; }
      `,
      "app/routes/caught.tsx": `
        import { routeError } from "${runtimeImport}";
        export function loader(){ return routeError(418, { reason: "teapot" }); }
        export function CatchBoundary(){ return <h1>caught</h1>; }
        export default function Caught(){ return <p>never</p>; }
      `,
      "app/routes/error.tsx": `
        export function loader(){ throw new Error("boom"); }
        export function ErrorBoundary(){ return <h1>errored</h1>; }
        export default function ErrorRoute(){ return <p>never</p>; }
      `,
      "app/routes/redirected.tsx": `
        import { redirect } from "${runtimeImport}";
        export function loader(){ return redirect("/"); }
        export default function Redirected(){ return <p>never</p>; }
      `,
      "app/routes/response-loader.tsx": `
        export function loader(){ return new Response("plain", { status: 202 }); }
        export default function ResponseLoader(){ return <p>never</p>; }
      `,
      "app/routes/middleware-response.tsx": `
        export async function middleware(){
          return new Response("middleware-plain", { status: 204 });
        }
        export default function MiddlewareResponse(){ return <p>never</p>; }
      `,
      "app/routes/response-thrown.tsx": `
        export function loader(){ throw new Response("nope", { status: 418, statusText: "Teapot" }); }
        export function CatchBoundary(){ return <h1>response-caught</h1>; }
        export default function ResponseThrown(){ return <p>never</p>; }
      `,
    }, "rbssr-server-transition");

    const server = createServer(
      { appDir: path.join(root, "app"), mode: "development" },
      {
        dev: true,
        devAssets: createDevAssets([
          "index",
          "deferred",
          "caught",
          "error",
          "redirected",
          "middleware_response",
          "response_loader",
          "response_thrown",
        ]),
      },
    );

    const deferredResponse = await server.fetch(new Request("http://localhost/__rbssr/transition?to=/deferred"));
    expect(deferredResponse.status).toBe(200);
    const deferredLines = await readTransitionLines(deferredResponse);
    expect(deferredLines[0]?.type).toBe("initial");
    expect(deferredLines[0]?.kind).toBe("page");
    expect(deferredLines.some(line => line.type === "deferred")).toBe(true);

    const caughtResponse = await server.fetch(new Request("http://localhost/__rbssr/transition?to=/caught"));
    const caughtLines = await readTransitionLines(caughtResponse);
    expect(caughtLines[0]?.kind).toBe("catch");
    expect(caughtLines[0]?.status).toBe(418);

    const errorResponse = await server.fetch(new Request("http://localhost/__rbssr/transition?to=/error"));
    const errorLines = await readTransitionLines(errorResponse);
    expect(errorLines[0]?.kind).toBe("error");
    expect(errorLines[0]?.status).toBe(500);

    const notFoundResponse = await server.fetch(new Request("http://localhost/__rbssr/transition?to=/missing"));
    const notFoundLines = await readTransitionLines(notFoundResponse);
    expect(notFoundLines[0]?.kind).toBe("not_found");
    expect(notFoundLines[0]?.status).toBe(404);
    expect(String(notFoundLines[0]?.head ?? "")).toContain("/__rbssr/client/shared.css?v=0");

    const redirectResponse = await server.fetch(new Request("http://localhost/__rbssr/transition?to=/redirected"));
    const redirectLines = await readTransitionLines(redirectResponse);
    expect(redirectLines[0]).toEqual({
      type: "redirect",
      location: "/",
      status: 302,
    });

    const responseThrown = await server.fetch(new Request("http://localhost/__rbssr/transition?to=/response-thrown"));
    const responseThrownLines = await readTransitionLines(responseThrown);
    expect(responseThrownLines[0]?.kind).toBe("catch");
    expect(responseThrownLines[0]?.status).toBe(418);

    const crossOriginResponse = await server.fetch(
      new Request("http://localhost/__rbssr/transition?to=https://example.com/elsewhere"),
    );
    expect(crossOriginResponse.status).toBe(400);
    expect(await crossOriginResponse.text()).toContain("Cross-origin transitions are not allowed");

    const malformedResponse = await server.fetch(new Request("http://localhost/__rbssr/transition"));
    expect(malformedResponse.status).toBe(400);
  });

  it("falls back cleanly when a loader returns a non-streamable raw Response during a transition", async () => {
    const root = await createFixtureApp(tempDirs, {
      "app/root.tsx": `export default function Root(){ return <main>root</main>; }`,
      "app/routes/response-loader.tsx": `
        export function loader(){ return new Response("plain", { status: 202 }); }
        export default function ResponseLoader(){ return <p>never</p>; }
      `,
    }, "rbssr-server-transition-response-loader");

    const server = createServer(
      { appDir: path.join(root, "app"), mode: "development" },
      { dev: true, devAssets: createDevAssets(["response_loader"]) },
    );

    const response = await server.fetch(new Request("http://localhost/__rbssr/transition?to=/response-loader"));
    expect(response.status).toBe(200);
    const lines = await readTransitionLines(response);
    expect(lines).toEqual([
      {
        type: "document",
        location: "http://localhost/response-loader",
        status: 202,
      },
    ]);
  });

  it("falls back cleanly when middleware returns a non-streamable raw Response during a transition", async () => {
    const root = await createFixtureApp(tempDirs, {
      "app/root.tsx": `export default function Root(){ return <main>root</main>; }`,
      "app/routes/middleware-response.tsx": `
        export async function middleware(){
          return new Response("middleware-plain", { status: 204 });
        }
        export default function MiddlewareResponse(){ return <p>never</p>; }
      `,
    }, "rbssr-server-transition-middleware-response");

    const server = createServer(
      { appDir: path.join(root, "app"), mode: "development" },
      { dev: true, devAssets: createDevAssets(["middleware_response"]) },
    );

    const response = await server.fetch(new Request("http://localhost/__rbssr/transition?to=/middleware-response"));
    expect(response.status).toBe(200);
    const lines = await readTransitionLines(response);
    expect(lines).toEqual([
      {
        type: "document",
        location: "http://localhost/middleware-response",
        status: 204,
      },
    ]);
  });
});
