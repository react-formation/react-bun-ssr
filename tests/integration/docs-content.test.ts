import path from "node:path";
import { describe, expect, it } from "bun:test";
import { sidebar } from "../../app/routes/docs/_sidebar";

describe("docs content", () => {
  it("loads introduction markdown source", async () => {
    const filePath = path.resolve(process.cwd(), "app/routes/docs/getting-started/introduction.md");
    const source = await Bun.file(filePath).text();
    expect(source).toContain("title: Introduction");
    expect(source).toContain("react-bun-ssr");
  });

  it("keeps sidebar slugs unique", () => {
    const slugs = sidebar.flatMap(section => section.items.map(item => item.slug));
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
