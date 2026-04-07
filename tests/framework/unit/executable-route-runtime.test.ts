import { describe, expect, it } from "bun:test";
import { createExecutableRouteRuntime } from "../../../framework/runtime/executable-route-runtime";
import type {
  ApiRouteDefinition,
  ApiRouteModule,
  Middleware,
  PageRouteDefinition,
  RouteMatch,
  RouteModuleBundle,
} from "../../../framework/runtime/types";

function createPageMatch(): RouteMatch<PageRouteDefinition> {
  return {
    route: {
      type: "page",
      id: "docs__guide",
      filePath: "/app/routes/docs/guide.tsx",
      serverFilePath: "/app/routes/docs/guide.server.tsx",
      routePath: "/docs/:slug",
      segments: [
        { kind: "static", value: "docs" },
        { kind: "dynamic", value: "slug" },
      ],
      score: 50,
      layoutFiles: ["/app/routes/_layout.tsx"],
      middlewareFiles: ["/app/routes/_middleware.ts", "/app/routes/docs/_middleware.ts"],
      directory: "docs",
    },
    params: {
      slug: "guide",
    },
  };
}

function createApiMatch(): RouteMatch<ApiRouteDefinition> {
  return {
    route: {
      type: "api",
      id: "api__search",
      filePath: "/app/routes/api/search.ts",
      routePath: "/api/search",
      segments: [
        { kind: "static", value: "api" },
        { kind: "static", value: "search" },
      ],
      score: 60,
      middlewareFiles: ["/app/routes/_middleware.ts"],
      directory: "api",
    },
    params: {},
  };
}

function namedMiddleware(name: string, calls: string[]): Middleware {
  return async (_ctx, next) => {
    calls.push(name);
    return next();
  };
}

describe("executable route runtime", () => {
  it("prepares page routes with route bundle, ordered middleware, and request context", async () => {
    const calls: string[] = [];
    const globalMiddleware = namedMiddleware("global", calls);
    const nestedMiddleware = namedMiddleware("nested", calls);
    const routeMiddleware = namedMiddleware("route", calls);
    const routeBundle: RouteModuleBundle = {
      root: {
        default: () => null,
      },
      layouts: [
        {
          default: () => null,
        },
      ],
      route: {
        default: () => null,
        middleware: [routeMiddleware],
      },
    };
    const routeLoadOptions = {
      cacheBustKey: "dev-1",
      serverBytecode: false,
      devSourceImports: false,
      nodeEnv: "development" as const,
    };
    const middlewareLoadOptions = {
      ...routeLoadOptions,
      devSourceImports: true,
    };
    let receivedRouteOptions: unknown = null;
    let receivedGlobalOptions: unknown = null;
    let receivedNestedOptions: unknown = null;

    const runtime = createExecutableRouteRuntime({
      rootFilePath: "/app/root.tsx",
      globalMiddlewareFilePath: "/app/middleware.ts",
      deps: {
        async loadRouteBundle(options) {
          receivedRouteOptions = options;
          return routeBundle;
        },
        async loadApiModule() {
          throw new Error("API module should not load for page routes.");
        },
        async loadGlobalMiddleware(_filePath, options) {
          receivedGlobalOptions = options;
          return [globalMiddleware];
        },
        async loadNestedMiddleware(_filePaths, options) {
          receivedNestedOptions = options;
          return [nestedMiddleware];
        },
      },
    });

    const request = new Request("http://localhost/docs/guide", {
      headers: {
        cookie: "theme=dark; session=abc",
      },
    });
    const executable = await runtime.preparePageRoute({
      match: createPageMatch(),
      request,
      url: new URL("http://localhost/docs/guide"),
      routeLoadOptions,
      middlewareLoadOptions,
    });

    expect(receivedRouteOptions).toEqual({
      rootFilePath: "/app/root.tsx",
      layoutFiles: ["/app/routes/_layout.tsx"],
      routeFilePath: "/app/routes/docs/guide.tsx",
      routeServerFilePath: "/app/routes/docs/guide.server.tsx",
      ...routeLoadOptions,
    });
    expect(receivedGlobalOptions).toEqual(middlewareLoadOptions);
    expect(receivedNestedOptions).toEqual(middlewareLoadOptions);
    expect(executable.modules).toBe(routeBundle);
    expect(executable.middleware).toEqual([globalMiddleware, nestedMiddleware, routeMiddleware]);
    expect(executable.requestContext.request).toBe(request);
    expect(executable.requestContext.url.pathname).toBe("/docs/guide");
    expect(executable.requestContext.params).toEqual({ slug: "guide" });
    expect(executable.requestContext.cookies.get("theme")).toBe("dark");
    executable.requestContext.response.headers.set("x-prepared", "1");
    expect(executable.requestContext.response.headers.get("x-prepared")).toBe("1");
  });

  it("prepares API routes with API module, ordered middleware, and request context", async () => {
    const calls: string[] = [];
    const globalMiddleware = namedMiddleware("global", calls);
    const nestedMiddleware = namedMiddleware("nested", calls);
    const apiModule: ApiRouteModule = {
      GET: () => Response.json({ ok: true }),
    };
    const loadOptions = {
      cacheBustKey: "api-1",
      serverBytecode: true,
      nodeEnv: "production" as const,
    };
    let receivedApiPath = "";
    let receivedNestedFiles: string[] = [];

    const runtime = createExecutableRouteRuntime({
      rootFilePath: "/app/root.tsx",
      globalMiddlewareFilePath: "/app/middleware.ts",
      deps: {
        async loadRouteBundle() {
          throw new Error("Route bundle should not load for API routes.");
        },
        async loadApiModule(filePath, options) {
          receivedApiPath = filePath;
          expect(options).toEqual(loadOptions);
          return apiModule;
        },
        async loadGlobalMiddleware(filePath, options) {
          expect(filePath).toBe("/app/middleware.ts");
          expect(options).toEqual(loadOptions);
          return [globalMiddleware];
        },
        async loadNestedMiddleware(filePaths, options) {
          receivedNestedFiles = filePaths;
          expect(options).toEqual(loadOptions);
          return [nestedMiddleware];
        },
      },
    });

    const request = new Request("http://localhost/api/search?q=router");
    const executable = await runtime.prepareApiRoute({
      match: createApiMatch(),
      request,
      url: new URL("http://localhost/api/search?q=router"),
      loadOptions,
    });

    expect(receivedApiPath).toBe("/app/routes/api/search.ts");
    expect(receivedNestedFiles).toEqual(["/app/routes/_middleware.ts"]);
    expect(executable.module).toBe(apiModule);
    expect(executable.middleware).toEqual([globalMiddleware, nestedMiddleware]);
    expect(executable.requestContext.request).toBe(request);
    expect(executable.requestContext.url.searchParams.get("q")).toBe("router");
  });
});
