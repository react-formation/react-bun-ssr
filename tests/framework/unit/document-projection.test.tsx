import { describe, expect, it } from "bun:test";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { projectRouteDocument } from "../../../framework/runtime/document-projection";
import type { RouteErrorResponse, RouteModuleBundle } from "../../../framework/runtime/types";

const modules: RouteModuleBundle = {
  root: {
    default: () => null,
    meta: ctx => ({
      description: `root:${(ctx.data as { stage?: string } | null)?.stage ?? "none"}`,
    }),
  },
  layouts: [
    {
      default: () => null,
      head: ctx => createElement("meta", {
        name: "layout-stage",
        content: (ctx.data as { stage?: string } | null)?.stage ?? "none",
      }),
    },
  ],
  route: {
    default: () => null,
    head: ctx => createElement(Fragment, null,
      createElement("title", null, `Route ${(ctx.data as { stage?: string } | null)?.stage ?? "none"}`),
      ctx.error
        ? createElement("meta", {
          name: "route-error",
          content: String((ctx.error as { status?: number }).status ?? "unknown"),
        })
        : null,
    ),
    meta: ctx => ({
      robots: ctx.error ? "noindex" : "index,follow",
    }),
  },
};

function renderHeadElements(projection: ReturnType<typeof projectRouteDocument>): string {
  return renderToStaticMarkup(createElement(Fragment, null, projection.headElements));
}

describe("document projection", () => {
  it("separates render and client payload data while projecting head from render data", () => {
    const renderData = { stage: "render" };
    const clientData = {
      stage: "client",
      delayed: {
        __rbssrDeferred: "route:delayed:1",
      },
    };

    const projection = projectRouteDocument({
      modules,
      routeId: "docs__guide",
      params: { slug: "guide" },
      url: "http://localhost/docs/guide",
      loaderDataForRender: renderData,
      loaderDataForClient: clientData,
      assets: {
        script: "/client/docs__guide.js",
        css: ["/client/root.css", "/client/docs.css"],
        devVersion: 9,
      },
    });

    expect(projection.renderPayload).toEqual({
      routeId: "docs__guide",
      loaderData: renderData,
      params: { slug: "guide" },
      url: "http://localhost/docs/guide",
    });
    expect(projection.clientPayload).toEqual({
      routeId: "docs__guide",
      loaderData: clientData,
      params: { slug: "guide" },
      url: "http://localhost/docs/guide",
    });
    expect(projection.assets).toEqual({
      script: "/client/docs__guide.js",
      css: ["/client/root.css", "/client/docs.css"],
      devVersion: 9,
    });

    const headMarkup = renderHeadElements(projection);
    expect(headMarkup).toContain("<title>Route render</title>");
    expect(headMarkup).toContain('name="description" content="root:render"');
    expect(headMarkup).not.toContain("client");

    expect(projection.managedHeadMarkup).toContain("<title>Route render</title>");
    expect(projection.managedHeadMarkup).toContain('name="description" content="root:render"');
    expect(projection.managedHeadMarkup.indexOf("/client/root.css?v=9")).toBeLessThan(
      projection.managedHeadMarkup.indexOf("/client/docs.css?v=9"),
    );
    expect(projection.managedHeadMarkup).toContain("/client/root.css?v=9");
    expect(projection.managedHeadMarkup).toContain("/client/docs.css?v=9");
    expect(projection.managedHeadMarkup).not.toContain("Route client");
    expect(projection.managedHeadMarkup).not.toContain("root:client");
  });

  it("projects catch/error payloads consistently into render payload, client payload, and head", () => {
    const error: RouteErrorResponse = {
      type: "route_error",
      status: 404,
      statusText: "Not Found",
      data: {
        message: "Missing guide",
      },
    };

    const projection = projectRouteDocument({
      modules,
      routeId: "docs__missing",
      params: { slug: "missing" },
      url: "http://localhost/docs/missing",
      loaderDataForRender: null,
      loaderDataForClient: null,
      error,
      assets: {
        css: ["/client/missing.css"],
      },
    });

    expect(projection.renderPayload.error).toBe(error);
    expect(projection.clientPayload.error).toBe(error);
    expect(renderHeadElements(projection)).toContain('name="route-error" content="404"');
    expect(projection.managedHeadMarkup).toContain('name="robots" content="noindex"');
    expect(projection.managedHeadMarkup).toContain("/client/missing.css");
  });
});
