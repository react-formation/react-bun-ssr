import path from "node:path";
import { describe, expect, it } from "bun:test";
import { toAbsoluteUrl } from "../../app/lib/site.ts";
import blogManifest from "../../app/routes/blog/blog-manifest.json";

interface BlogManifestEntry {
  slug: string;
  title: string;
  author: string;
  publishedAt: string;
  readingMinutes: number;
  canonicalUrl: string;
}

describe("blog content", () => {
  it("ships the launch blog post with the expected source content", async () => {
    const filePath = path.resolve(process.cwd(), "app/routes/blog/why-i-built-a-bun-native-ssr-framework.md");
    const source = await Bun.file(filePath).text();

    expect(source).toContain("author: gaudiauj");
    expect(source).toContain("publishedAt: 2026-03-01");
    expect(source).toContain("https://bun.sh/");
    expect(source).toContain("/docs/start/quick-start");
    expect(source).toContain("/docs/routing/middleware");
    expect(source).toContain("/docs/rendering/streaming-deferred");
  });

  it("ships the AI engineering post with the expected source content", async () => {
    const filePath = path.resolve(process.cwd(), "app/routes/blog/how-i-built-react-bun-ssr-with-ai.md");
    const source = await Bun.file(filePath).text();

    expect(source).toContain("title: How I Built react-bun-ssr With AI and Kept the Engineering Bar High");
    expect(source).toContain("author: gaudiauj");
    expect(source).toContain("publishedAt: 2026-03-01");
    expect(source).toContain("https://bun.sh/");
    expect(source).toContain("/docs/api/bun-runtime-apis");
    expect(source).toContain("/docs/data/error-handling");
    expect(source).toContain("AI could execute, but it could not decide");
  });

  it("keeps the generated blog manifest aligned with the launch post", () => {
    const manifest = blogManifest as BlogManifestEntry[];
    const firstPost = manifest[0];

    expect(firstPost?.slug).toBe("how-i-built-react-bun-ssr-with-ai");
    expect(firstPost?.author).toBe("gaudiauj");
    expect(firstPost?.publishedAt).toBe("2026-03-01");
    expect(firstPost?.readingMinutes).toBeGreaterThan(1);
    expect(firstPost?.canonicalUrl).toBe(toAbsoluteUrl("/blog/how-i-built-react-bun-ssr-with-ai"));
  });

  it("broadens the root chrome beyond docs-only copy", async () => {
    const rootPath = path.resolve(process.cwd(), "app/root.tsx");
    const rootSource = await Bun.file(rootPath).text();

    expect(rootSource).toContain("to=\"/blog\"");
    expect(rootSource).toContain("Page not found.");
    expect(rootSource).not.toContain("Documentation page not found.");
  });
});
