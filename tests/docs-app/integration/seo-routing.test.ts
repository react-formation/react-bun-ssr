import path from "node:path";
import { describe, expect, it } from "bun:test";
import { toAbsoluteUrl } from "../../../app/lib/site.ts";
import { createServer } from "../../../framework/runtime/server";

describe("docs app SEO routing", () => {
  it("redirects duplicate docs URLs and renders canonical docs URLs", async () => {
    const server = createServer(
      {
        appDir: path.join(process.cwd(), "app"),
        mode: "development",
      },
      {
        dev: true,
      },
    );

    const docsResponse = await server.fetch(new Request("http://localhost/docs"));
    expect(docsResponse.status).toBe(200);
    const docsHtml = await docsResponse.text();
    expect(docsHtml).toContain(`<link rel="canonical" href="${toAbsoluteUrl("/docs")}"/>`);
    expect(docsHtml).toContain(`<meta property="og:url" content="${toAbsoluteUrl("/docs")}"/>`);

    const deepDocsResponse = await server.fetch(new Request("http://localhost/docs/data/loaders"));
    expect(deepDocsResponse.status).toBe(200);
    const deepDocsHtml = await deepDocsResponse.text();
    expect(deepDocsHtml).toContain(
      `<link rel="canonical" href="${toAbsoluteUrl("/docs/data/loaders")}"/>`,
    );
    expect(deepDocsHtml).toContain(
      `<meta property="og:url" content="${toAbsoluteUrl("/docs/data/loaders")}"/>`,
    );

    const trailingSlashResponse = await server.fetch(
      new Request("http://localhost/docs/?utm_source=test"),
    );
    expect(trailingSlashResponse.status).toBe(308);
    expect(trailingSlashResponse.headers.get("location")).toBe("/docs?utm_source=test");

    const rootResponse = await server.fetch(new Request("http://localhost/"));
    expect(rootResponse.status).toBe(308);
    expect(rootResponse.headers.get("location")).toBe("/docs");
  });
});
