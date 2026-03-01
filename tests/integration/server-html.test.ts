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

describe("server HTML request contracts", () => {
  it("supports object, primitive, and null loader results plus cookies, locals, and HEAD", async () => {
    const runtimeImport = "react-bun-ssr/route";
    const root = await createFixtureApp(tempDirs, {
      "app/root.tsx": `
        import { Outlet } from "${runtimeImport}";
        export default function Root(){ return <main><Outlet /></main>; }
        export function NotFound(){ return <h1>root-missing</h1>; }
      `,
      "app/middleware.ts": `
        export default async function middleware(ctx, next) {
          ctx.locals.viewer = "alice";
          return next();
        }
      `,
      "app/routes/object.tsx": `
        import { useLoaderData } from "${runtimeImport}";
        export function loader(){ return { message: "object" }; }
        export default function ObjectRoute(){
          const data = useLoaderData<{ message: string }>();
          return <h1>{data.message}</h1>;
        }
      `,
      "app/routes/primitive.tsx": `
        import { useLoaderData } from "${runtimeImport}";
        export function loader(){ return "primitive"; }
        export default function PrimitiveRoute(){
          const data = useLoaderData<string>();
          return <h1>{data}</h1>;
        }
      `,
      "app/routes/empty.tsx": `
        import { useLoaderData } from "${runtimeImport}";
        export function loader(){ return null; }
        export default function EmptyRoute(){
          const data = useLoaderData<null>();
          return <h1>{String(data)}</h1>;
        }
      `,
      "app/routes/context.tsx": `
        import { useLoaderData } from "${runtimeImport}";
        export function loader({ cookies, locals }){
          return {
            session: cookies.get("session") ?? null,
            viewer: String(locals.viewer ?? "missing"),
          };
        }
        export default function ContextRoute(){
          const data = useLoaderData<{ session: string | null; viewer: string }>();
          return <h1>{data.session}:{data.viewer}</h1>;
        }
      `,
      "app/routes/raw-response.tsx": `
        export function loader(){ return new Response("plain-response", { status: 202 }); }
        export default function RawResponseRoute(){ return <p>never</p>; }
      `,
      "app/routes/missing.tsx": `
        import { notFound } from "${runtimeImport}";
        export function loader(){ return notFound({ slug: "missing" }); }
        export function NotFound(){ return <h1>route-missing</h1>; }
        export default function MissingRoute(){ return <p>never</p>; }
      `,
    }, "rbssr-server-html");

    const server = createServer(
      { appDir: path.join(root, "app"), mode: "development" },
      { dev: true, devAssets: createDevAssets(["object", "primitive", "empty", "context", "raw_response", "missing"]) },
    );

    const objectResponse = await server.fetch(new Request("http://localhost/object"));
    expect(objectResponse.status).toBe(200);
    expect(await objectResponse.text()).toContain("object");

    const primitiveResponse = await server.fetch(new Request("http://localhost/primitive"));
    expect(primitiveResponse.status).toBe(200);
    expect(await primitiveResponse.text()).toContain("primitive");

    const emptyResponse = await server.fetch(new Request("http://localhost/empty"));
    expect(emptyResponse.status).toBe(200);
    expect(await emptyResponse.text()).toContain("null");

    const contextResponse = await server.fetch(
      new Request("http://localhost/context", {
        headers: {
          cookie: "session=abc123",
        },
      }),
    );
    expect(contextResponse.status).toBe(200);
    const contextHtml = await contextResponse.text();
    expect(contextHtml).toContain("abc123");
    expect(contextHtml).toContain("alice");

    const rawResponse = await server.fetch(new Request("http://localhost/raw-response"));
    expect(rawResponse.status).toBe(202);
    expect(await rawResponse.text()).toBe("plain-response");

    const headResponse = await server.fetch(
      new Request("http://localhost/object", { method: "HEAD" }),
    );
    expect(headResponse.status).toBe(200);
    expect(await headResponse.text()).toBe("");

    const notFoundResponse = await server.fetch(new Request("http://localhost/missing"));
    expect(notFoundResponse.status).toBe(404);
    expect(await notFoundResponse.text()).toContain("route-missing");

    const unmatchedResponse = await server.fetch(new Request("http://localhost/does-not-exist"));
    expect(unmatchedResponse.status).toBe(404);
    expect(await unmatchedResponse.text()).toContain("root-missing");
  });

  it("skips request preparation hooks for static assets and internal dev endpoints", async () => {
    const root = await createFixtureApp(tempDirs, {
      "app/root.tsx": `export default function Root(){ return <main />; }`,
      "app/routes/index.tsx": `export default function Index(){ return <h1>home</h1>; }`,
      "app/public/logo.txt": "logo",
    }, "rbssr-server-html-hook-skip");

    let hookCalls = 0;
    const server = createServer(
      { appDir: path.join(root, "app"), mode: "development" },
      {
        dev: true,
        devAssets: createDevAssets(["index"]),
        onBeforeRequest: async () => {
          hookCalls += 1;
        },
        reloadVersion: () => 1,
      },
    );

    const staticResponse = await server.fetch(new Request("http://localhost/logo.txt"));
    expect(staticResponse.status).toBe(200);
    expect(hookCalls).toBe(0);

    const internalResponse = await server.fetch(new Request("http://localhost/__rbssr/version"));
    expect(internalResponse.status).toBe(200);
    expect(hookCalls).toBe(0);

    const pageResponse = await server.fetch(new Request("http://localhost/"));
    expect(pageResponse.status).toBe(200);
    expect(hookCalls).toBe(1);
  });
});
