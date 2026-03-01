import path from "node:path";
import { describe, expect, it } from "bun:test";
import manifest from "../../app/routes/docs/docs-manifest.json";
import { sidebar } from "../../app/routes/docs/_sidebar";

interface DocManifestEntry {
  slug: string;
  title: string;
  headings: Array<{ text: string; id: string; depth: number }>;
}

describe("docs content", () => {
  it("loads overview markdown source", async () => {
    const filePath = path.resolve(process.cwd(), "app/routes/docs/start/overview.md");
    const source = await Bun.file(filePath).text();
    expect(source).toContain("title: Overview");
    expect(source).toContain("Task Tracker");
  });

  it("includes the Bun runtime mapping reference page", async () => {
    const filePath = path.resolve(process.cwd(), "app/routes/docs/api/bun-runtime-apis.md");
    const source = await Bun.file(filePath).text();
    expect(source).toContain("## Cookies");
    expect(source).toContain("https://bun.com/docs/api/cookie");
    expect(source).toContain("Map<string, string>");
  });

  it("includes a dedicated middleware guide", async () => {
    const filePath = path.resolve(process.cwd(), "app/routes/docs/routing/middleware.md");
    const source = await Bun.file(filePath).text();
    expect(source).toContain("## Execution order");
    expect(source).toContain("Response.redirect");
    expect(source).toContain("ctx.locals");
  });

  it("keeps sidebar slugs unique", () => {
    const slugs = sidebar.flatMap(section => section.items.map(item => item.slug));
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("builds manifest entries with extracted headings", () => {
    const entries = manifest as DocManifestEntry[];
    const loaders = entries.find(entry => entry.slug === "data/loaders");
    expect(loaders?.title).toBe("Loaders");
    expect(loaders?.headings.some(heading => heading.id === "return-model")).toBe(true);
  });

  it("keeps generated API docs linked to Bun cookie references", async () => {
    const filePath = path.resolve(process.cwd(), "app/routes/docs/api/react-bun-ssr-route.md");
    const source = await Bun.file(filePath).text();
    expect(source).toContain("https://bun.com/docs/api/cookie");
    expect(source).toContain("https://bun.com/docs/runtime/http/cookies");
  });
});
