import { describe, expect, it } from "bun:test";
import { renderDocument } from "../../framework/runtime/render";

describe("renderDocument dev reload", () => {
  it("uses SSE endpoint instead of polling version endpoint", () => {
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
    });

    expect(html).toContain("new EventSource('/__rbssr/events')");
    expect(html).not.toContain("/__rbssr/version");
  });
});
