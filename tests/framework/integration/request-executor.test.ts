import path from "node:path";
import { createElement } from "react";
import { afterEach, describe, expect, it, setDefaultTimeout } from "bun:test";
import { resolveConfig } from "../../../framework/runtime/config";
import { createRequestExecutor } from "../../../framework/runtime/request-executor";
import { createFixtureApp } from "../helpers/fixture-app";
import { createTempDirRegistry } from "../helpers/temp-dir";

const tempDirs = createTempDirRegistry();

setDefaultTimeout(20_000);

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

describe("request executor contracts", () => {
  it("renders the page HTML happy path through the executor boundary", async () => {
    const runtimeImport = "react-bun-ssr/route";
    const root = await createFixtureApp(tempDirs, {
      "app/root.tsx": `
        import { Outlet } from "${runtimeImport}";
        export default function Root(){ return <main><Outlet /></main>; }
      `,
      "app/middleware.ts": `
        export default async function middleware(ctx, next) {
          ctx.locals.viewer = "alice";
          ctx.response.headers.set("x-executor", "1");
          return next();
        }
      `,
      "app/routes/index.tsx": `
        import { useLoaderData } from "${runtimeImport}";
        export function loader({ locals }){
          return { viewer: String(locals.viewer ?? "missing") };
        }
        export default function Index(){
          const data = useLoaderData<{ viewer: string }>();
          return <h1>{data.viewer}</h1>;
        }
      `,
    }, "rbssr-request-executor");

    const executor = createRequestExecutor({
      config: resolveConfig({
        appDir: path.join(root, "app"),
        mode: "development",
      }),
      runtimeOptions: {
        dev: true,
        devAssets: createDevAssets(["index"]),
      },
    });

    const response = await executor.fetch(new Request("http://localhost/"));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-executor")).toBe("1");
    expect(html).toContain("alice");
    expect(html).toContain("/__rbssr/client/shared.css?v=0");
  });

  it("uses injected coarse dependencies for page execution", async () => {
    const root = await tempDirs.create("rbssr-request-executor-fakes");
    const resolvedConfig = resolveConfig({
      appDir: path.join(root, "app"),
      mode: "development",
    });
    const calls = {
      routeAdapter: 0,
      routeBundle: 0,
      renderer: 0,
    };

    const executor = createRequestExecutor({
      config: resolvedConfig,
      runtimeOptions: {
        dev: true,
        devAssets: createDevAssets(["index"]),
      },
      deps: {
        async getRouteAdapter() {
          calls.routeAdapter += 1;
          return {
            manifest: {
              pages: [
                {
                  type: "page",
                  id: "index",
                  filePath: path.join(root, "app/routes/index.tsx"),
                  routePath: "/",
                  segments: [],
                  score: 0,
                  layoutFiles: [],
                  middlewareFiles: [],
                  directory: "",
                },
              ],
              api: [],
            },
            matchPage() {
              return {
                route: {
                  type: "page",
                  id: "index",
                  filePath: path.join(root, "app/routes/index.tsx"),
                  routePath: "/",
                  segments: [],
                  score: 0,
                  layoutFiles: [],
                  middlewareFiles: [],
                  directory: "",
                },
                params: {},
              };
            },
            matchApi() {
              return null;
            },
          };
        },
        async loadRouteBundle() {
          calls.routeBundle += 1;
          return {
            root: {
              default: () => createElement("main", null),
            },
            layouts: [],
            route: {
              default: () => createElement("h1", null, "fake-page"),
            },
          };
        },
        async loadGlobalMiddleware() {
          return [];
        },
        async loadNestedMiddleware() {
          return [];
        },
        async renderDocumentStream() {
          calls.renderer += 1;
          return new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new TextEncoder().encode("<!doctype html><html><body>fake-renderer</body></html>"));
              controller.close();
            },
          });
        },
      },
    });

    const response = await executor.fetch(new Request("http://localhost/"));

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("fake-renderer");
    expect(calls.routeAdapter).toBe(1);
    expect(calls.routeBundle).toBe(1);
    expect(calls.renderer).toBe(1);
  });

  it("handles static assets and dev endpoints without request preparation hooks", async () => {
    const root = await createFixtureApp(tempDirs, {
      "app/root.tsx": `export default function Root(){ return <main />; }`,
      "app/routes/index.tsx": `export default function Index(){ return <h1>home</h1>; }`,
      "app/public/logo.txt": "logo",
    }, "rbssr-request-executor-static");

    let hookCalls = 0;
    const executor = createRequestExecutor({
      config: resolveConfig({
        appDir: path.join(root, "app"),
        mode: "development",
      }),
      runtimeOptions: {
        dev: true,
        devAssets: createDevAssets(["index"]),
        onBeforeRequest: async () => {
          hookCalls += 1;
        },
        reloadVersion: () => 1,
      },
    });

    const staticResponse = await executor.fetch(new Request("http://localhost/logo.txt"));
    expect(staticResponse.status).toBe(200);
    expect(hookCalls).toBe(0);

    const internalResponse = await executor.fetch(new Request("http://localhost/__rbssr/version"));
    expect(internalResponse.status).toBe(200);
    expect(hookCalls).toBe(0);

    const pageResponse = await executor.fetch(new Request("http://localhost/"));
    expect(pageResponse.status).toBe(200);
    expect(hookCalls).toBe(1);
  });

  it("handles API, action, and transition requests through the executor boundary", async () => {
    const runtimeImport = "react-bun-ssr/route";
    const root = await createFixtureApp(tempDirs, {
      "app/root.tsx": `
        import { Outlet } from "${runtimeImport}";
        export default function Root(){ return <main><Outlet /></main>; }
      `,
      "app/middleware.ts": `
        export default async function middleware(ctx, next) {
          ctx.locals.viewer = "alice";
          return next();
        }
      `,
      "app/routes/form.tsx": `
        export function action({ formData, locals }){
          return {
            name: String(formData?.get("name") ?? ""),
            viewer: String(locals.viewer ?? "missing"),
          };
        }
        export default function FormRoute(){ return <h1>form</h1>; }
      `,
      "app/routes/transition.tsx": `
        import { defer } from "${runtimeImport}";
        export function loader(){
          return defer({ slow: Promise.resolve("done") });
        }
        export default function TransitionRoute(){ return <h1>transition</h1>; }
      `,
      "app/routes/api/hello.ts": `
        export function GET(ctx){
          return { ok: true, viewer: String(ctx.locals.viewer ?? "missing") };
        }
      `,
    }, "rbssr-request-executor-requests");

    const executor = createRequestExecutor({
      config: resolveConfig({
        appDir: path.join(root, "app"),
        mode: "development",
      }),
      runtimeOptions: {
        dev: true,
        devAssets: createDevAssets(["form", "transition"]),
      },
    });

    const apiResponse = await executor.fetch(new Request("http://localhost/api/hello"));
    expect(apiResponse.status).toBe(200);
    expect(await apiResponse.json()).toEqual({ ok: true, viewer: "alice" });

    const actionResponse = await executor.fetch(new Request("http://localhost/__rbssr/action?to=/form", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "name=Ada",
    }));
    expect(actionResponse.status).toBe(200);
    expect(await actionResponse.json()).toEqual({
      type: "data",
      status: 200,
      data: { name: "Ada", viewer: "alice" },
    });

    const transitionResponse = await executor.fetch(new Request("http://localhost/__rbssr/transition?to=/transition"));
    expect(transitionResponse.status).toBe(200);
    const lines = await readTransitionLines(transitionResponse);
    expect(lines[0]?.type).toBe("initial");
    expect(lines[0]?.kind).toBe("page");
    expect(lines.some(line => line.type === "deferred")).toBe(true);
  });
});
