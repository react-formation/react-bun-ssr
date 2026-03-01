import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import { makeTempDir, removePath, writeText } from "../../framework/runtime/io";
import { buildBlogManifest } from "../../scripts/build-blog-manifest";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => removePath(dir)));
});

describe("buildBlogManifest", () => {
  it("sorts posts by publish date, computes reading time, and extracts headings", async () => {
    const blogDir = await makeTempDir("blog-manifest-test");
    tempDirs.push(blogDir);

    await writeText(
      path.join(blogDir, "older-post.md"),
      `---\ntitle: Older Post\ndescription: First\nsection: Blog\nauthor: gaudiauj\npublishedAt: 2026-02-27\ntags: bun,ssr\n---\n\n## Earlier section\n\n${"word ".repeat(240)}`,
    );
    await writeText(
      path.join(blogDir, "newer-post.md"),
      `---\ntitle: Newer Post\ndescription: Second\nsection: Blog\nauthor: gaudiauj\npublishedAt: 2026-03-01\ntags: blog,launch\n---\n\n## Launch notes\n\nBody text`,
    );

    const manifest = await buildBlogManifest({ blogDir });

    expect(manifest.map(entry => entry.slug)).toEqual(["newer-post", "older-post"]);
    expect(manifest[0]?.headings).toEqual([{ text: "Launch notes", id: "launch-notes", depth: 2 }]);
    expect(manifest[0]?.canonicalUrl).toBe("https://react-bun-ssr.fly.dev/blog/newer-post");
    expect(manifest[0]?.nextSlug).toBe("older-post");
    expect(manifest[1]?.prevSlug).toBe("newer-post");
    expect(manifest[1]?.readingMinutes).toBe(2);
    expect(manifest[0]?.publishedLabel).toBe("March 1, 2026");
  });

  it("rejects missing author", async () => {
    const blogDir = await makeTempDir("blog-manifest-missing-author");
    tempDirs.push(blogDir);

    await writeText(
      path.join(blogDir, "invalid-post.md"),
      `---\ntitle: Invalid\ndescription: Broken\nsection: Blog\npublishedAt: 2026/03/01\ntags: bun\n---\n\nBody`,
    );

    await expect(buildBlogManifest({ blogDir })).rejects.toThrow("Missing frontmatter field 'author'");
  });

  it("rejects invalid publish dates", async () => {
    const blogDir = await makeTempDir("blog-manifest-invalid-date");
    tempDirs.push(blogDir);

    await writeText(
      path.join(blogDir, "invalid-post.md"),
      `---\ntitle: Invalid\ndescription: Broken\nsection: Blog\nauthor: gaudiauj\npublishedAt: 2026/03/01\ntags: bun\n---\n\nBody`,
    );

    await expect(buildBlogManifest({ blogDir })).rejects.toThrow("Invalid publishedAt");
  });
});
