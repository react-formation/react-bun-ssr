import { describe, expect, it } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  collectHeadElements,
  collectHeadMarkup,
  createManagedHeadMarkup,
  renderDocument,
  renderDocumentStream,
} from "../../framework/runtime/render";
import type { RouteModuleBundle } from "../../framework/runtime/types";

const basePayload = {
  routeId: "index",
  data: { message: "ok" },
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
  it("orders head elements root -> layouts -> route and normalizes title children", () => {
    const markup = renderToStaticMarkup(
      createElement("div", null, collectHeadElements(modules, basePayload)),
    );

    expect(markup).toContain("<title>Root Title</title>");
    expect(markup).toContain('name="description" content="root-description"');
    expect(markup).toContain('property="layout:flag" content="on"');
    expect(markup).toContain('name="keywords" content="layout,docs"');
    expect(markup).toContain("<title>Route 7</title>");
    expect(markup.indexOf("root-description")).toBeLessThan(markup.indexOf("layout:flag"));
    expect(markup.indexOf("layout:flag")).toBeLessThan(markup.indexOf("Route 7"));
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
      "<title>Root Title</title>",
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
  });
});
