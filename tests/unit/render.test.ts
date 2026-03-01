import { describe, expect, it } from "bun:test";
import { createElement } from "react";
import { renderDocument, renderDocumentStream } from "../../framework/runtime/render";

describe("renderDocument dev reload", () => {
  it("uses the dev websocket endpoint instead of the old event stream", () => {
    const html = renderDocument({
      appMarkup: "<main>ok</main>",
      payload: {
        routeId: "index",
        data: null,
        params: {},
        url: "http://localhost/",
      },
      assets: {
        script: "/__rbssr/client/route__index.js",
        css: [],
        devVersion: 2,
      },
      headMarkup: "",
      routerSnapshot: {
        pages: [],
        assets: {},
        devVersion: 2,
      },
    });

    expect(html).toContain("new WebSocket");
    expect(html).toContain("/__rbssr/ws");
    expect(html).not.toContain("/__rbssr/version");
    expect(html).not.toContain("EventSource('/__rbssr/events')");
    expect(html).toContain("/__rbssr/client/route__index.js?v=2");
  });

  it("streams a full HTML document with deferred bootstrap/runtime scripts", async () => {
    const stream = await renderDocumentStream({
      appTree: createElement("main", null, "ok"),
      payload: {
        routeId: "index",
        data: {
          delayed: {
            __rbssrDeferred: "index:delayed:1",
          },
        },
        params: {},
        url: "http://localhost/",
      },
      assets: {
        script: "/client/route__index.js",
        css: ["/client/route__index.css"],
      },
      headElements: [createElement("title", { key: "t" }, "Title")],
      routerSnapshot: {
        pages: [],
        assets: {},
      },
      deferredSettleEntries: [
        {
          id: "index:delayed:1",
          settled: Promise.resolve({
            ok: true as const,
            value: "done",
          }),
        },
      ],
    });

    const html = await new Response(stream).text();
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("__RBSSR_PAYLOAD__");
    expect(html).toContain("window.__RBSSR_DEFERRED__");
    expect(html).toContain("__RBSSR_DEFERRED__.resolve");
    expect(html).toContain("/client/route__index.js");
  });
});
