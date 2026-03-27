import { describe, expect, it } from "bun:test";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  collectHeadElements,
  collectHeadMarkup,
  createManagedHeadMarkup,
  renderDocument,
  renderDocumentStream,
} from "../../../framework/runtime/render";
import type { RouteModuleBundle } from "../../../framework/runtime/types";

const basePayload = {
  routeId: "index",
  loaderData: { message: "ok" },
  params: { id: "42" },
  url: "http://localhost/tasks/42",
};

const modules: RouteModuleBundle = {
  root: {
    default: () => null,
    head: () => createElement("title", null, ["Root", " ", "Title"]),
    meta: () => ({ description: "root-description" }),
  },
  layouts: [
    {
      default: () => null,
      head: () => createElement("meta", { property: "layout:flag", content: "on" }),
      meta: () => ({ keywords: "layout,docs" }),
    },
  ],
  route: {
    default: () => null,
    head: () => createElement("title", null, ["Route", " ", 7]),
    meta: () => ({ robots: "index,follow" }),
  },
};

describe("document and head contracts", () => {
  it("orders head elements root -> layouts -> route, normalizes title children, and keeps only the deepest title", () => {
    const markup = renderToStaticMarkup(
      createElement("div", null, collectHeadElements(modules, basePayload)),
    );

    expect(markup).not.toContain("<title>Root Title</title>");
    expect(markup).toContain('name="description" content="root-description"');
    expect(markup).toContain('property="layout:flag" content="on"');
    expect(markup).toContain('name="keywords" content="layout,docs"');
    expect(markup).toContain("<title>Route 7</title>");
    expect(markup.indexOf("root-description")).toBeLessThan(markup.indexOf("layout:flag"));
    expect(markup.indexOf("layout:flag")).toBeLessThan(markup.indexOf("Route 7"));
  });

  it("keeps only the deepest meta value for the same name or property", () => {
    const markup = renderToStaticMarkup(
      createElement("div", null, collectHeadElements({
        root: {
          default: () => null,
          head: () => createElement(Fragment, null,
            createElement("meta", { name: "description", content: "root-head-description" }),
            createElement("meta", { property: "og:title", content: "root-og-title" }),
          ),
          meta: () => ({
            description: "root-description",
            robots: "index,follow",
          }),
        },
        layouts: [
          {
            default: () => null,
            meta: () => ({
              description: "layout-description",
            }),
          },
        ],
        route: {
          default: () => null,
          head: () => createElement(Fragment, null,
            createElement("meta", { property: "og:title", content: "route-og-title" }),
          ),
          meta: () => ({
            description: "route-description",
          }),
        },
      }, basePayload)),
    );

    expect(markup).not.toContain('content="root-head-description"');
    expect(markup).not.toContain('content="root-description"');
    expect(markup).not.toContain('content="layout-description"');
    expect(markup).toContain('name="description" content="route-description"');
    expect(markup).toContain('name="robots" content="index,follow"');
    expect(markup).not.toContain('content="root-og-title"');
    expect(markup).toContain('property="og:title" content="route-og-title"');
  });

  it("renders meta output as meta name tags and appends managed stylesheet links in order", () => {
    const headMarkup = collectHeadMarkup(modules, basePayload);
    const managedMarkup = createManagedHeadMarkup({
      headMarkup,
      assets: {
        script: "/client/route__index.js",
        css: ["/client/root.css", "/client/route.css"],
        devVersion: 3,
      },
    });

    expect(managedMarkup).toContain('name="description" content="root-description"');
    expect(managedMarkup).toContain('name="robots" content="index,follow"');
    expect(managedMarkup.indexOf("/client/root.css?v=3")).toBeLessThan(
      managedMarkup.indexOf("/client/route.css?v=3"),
    );
  });

  it("keeps the root title when nested modules do not provide one", () => {
    const markup = renderToStaticMarkup(
      createElement("div", null, collectHeadElements({
        ...modules,
        route: {
          default: () => null,
          meta: () => ({ robots: "index,follow" }),
        },
      }, basePayload)),
    );

    expect(markup).toContain("<title>Root Title</title>");
    expect(markup).not.toContain("<title>Route 7</title>");
  });

  it("deduplicates title elements even when parent modules return fragments", () => {
    const markup = renderToStaticMarkup(
      createElement("div", null, collectHeadElements({
        root: {
          default: () => null,
          head: () => createElement(Fragment, null,
            createElement("title", null, "Root Title"),
            createElement("meta", { name: "description", content: "root-description" }),
          ),
        },
        layouts: [],
        route: {
          default: () => null,
          head: () => createElement("title", null, "Route Title"),
        },
      }, basePayload)),
    );

    expect(markup).not.toContain("<title>Root Title</title>");
    expect(markup).toContain("<title>Route Title</title>");
    expect(markup).toContain('name="description" content="root-description"');
  });

  it("keeps streamed and string documents aligned on title, payload, router snapshot, and scripts", async () => {
    const headMarkup = collectHeadMarkup(modules, basePayload);
    const headElements = collectHeadElements(modules, basePayload);
    const routerSnapshot = {
      pages: [],
      assets: {},
      devVersion: 4,
    };
    const assets = {
      script: "/client/route__index.js",
      css: ["/client/route__index.css"],
      devVersion: 4,
    };

    const html = renderDocument({
      appMarkup: "<main>ok</main>",
      payload: basePayload,
      assets,
      headMarkup,
      routerSnapshot,
    });
    const stream = await renderDocumentStream({
      appTree: createElement("main", null, "ok"),
      payload: basePayload,
      assets,
      headElements,
      routerSnapshot,
      deferredSettleEntries: [],
    });
    const streamedHtml = await new Response(stream).text();

    for (const fragment of [
      "<title>Route 7</title>",
      "__RBSSR_PAYLOAD__",
      "__RBSSR_ROUTER__",
      "window.__RBSSR_DEFERRED__",
      "/client/route__index.css?v=4",
      "/client/route__index.js?v=4",
    ]) {
      expect(html).toContain(fragment);
      expect(streamedHtml).toContain(fragment);
    }

    expect(html).not.toContain("<title>Root Title</title>");
    expect(streamedHtml).not.toContain("<title>Root Title</title>");
  });
});
