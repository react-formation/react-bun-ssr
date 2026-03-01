import { describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";
import {
  Outlet,
  createCatchAppTree,
  createErrorAppTree,
} from "../../framework/runtime/tree";
import { createRouteErrorResponse } from "../../framework/runtime/route-errors";
import type { RouteModuleBundle } from "../../framework/runtime/types";

function createBundle(overrides: Partial<RouteModuleBundle["route"]> = {}): RouteModuleBundle {
  return {
    root: {
      default: () => <Outlet />,
      ...overrides,
    },
    layouts: [],
    route: {
      default: () => <h1>page</h1>,
      ...overrides,
    },
  };
}

describe("tree error boundaries", () => {
  it("prefers ErrorComponent over legacy ErrorBoundary", () => {
    const modules: RouteModuleBundle = {
      root: {
        default: () => <Outlet />,
        ErrorComponent: () => <p>error-component</p>,
        ErrorBoundary: () => <p>legacy-boundary</p>,
      },
      layouts: [],
      route: {
        default: () => <h1>page</h1>,
      },
    };
    const payload = {
      routeId: "index",
      data: null,
      params: {},
      url: "http://localhost/",
    };
    const tree = createErrorAppTree(modules, payload, new Error("boom"));
    expect(tree).not.toBeNull();
    const html = renderToString(tree!);
    expect(html).toContain("error-component");
    expect(html).not.toContain("legacy-boundary");
  });

  it("falls back to legacy ErrorBoundary when ErrorComponent is absent", () => {
    const modules: RouteModuleBundle = {
      root: {
        default: () => <Outlet />,
        ErrorBoundary: () => <p>legacy-boundary</p>,
      },
      layouts: [],
      route: {
        default: () => <h1>page</h1>,
      },
    };
    const payload = {
      routeId: "index",
      data: null,
      params: {},
      url: "http://localhost/",
    };
    const tree = createErrorAppTree(modules, payload, new Error("boom"));
    expect(tree).not.toBeNull();
    expect(renderToString(tree!)).toContain("legacy-boundary");
  });

  it("uses CatchBoundary for caught route errors", () => {
    const modules = createBundle({
      CatchBoundary: ({ error }) => <p>caught:{error.status}</p>,
      ErrorComponent: () => <p>error-component</p>,
    });
    const payload = {
      routeId: "index",
      data: null,
      params: {},
      url: "http://localhost/",
    };
    const caught = createRouteErrorResponse(409, { reason: "conflict" });
    const tree = createCatchAppTree(modules, payload, caught);
    expect(tree).not.toBeNull();
    const html = renderToString(tree!);
    expect(html).toContain("caught:");
    expect(html).toContain("409");
    expect(html).not.toContain("error-component");
  });

  it("prefers NotFound boundary for caught 404 errors", () => {
    const modules = createBundle({
      CatchBoundary: () => <p>catch-fallback</p>,
      NotFound: () => <h1>preferred-not-found</h1>,
    });
    const payload = {
      routeId: "index",
      data: null,
      params: {},
      url: "http://localhost/",
    };
    const caught = createRouteErrorResponse(404, { slug: "missing" });
    const tree = createCatchAppTree(modules, payload, caught);
    expect(tree).not.toBeNull();
    const html = renderToString(tree!);
    expect(html).toContain("preferred-not-found");
    expect(html).not.toContain("catch-fallback");
  });
});
