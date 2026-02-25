import { describe, expect, it } from "bun:test";
import { getAllDocSlugs, loadDocPage } from "../../app/lib/docs";

describe("docs content", () => {
  it("loads introduction markdown into html", () => {
    const page = loadDocPage("getting-started/introduction");
    expect(page.title).toBe("Introduction");
    expect(page.html).toContain("react-bun-ssr");
    expect(page.toc.length).toBeGreaterThan(0);
  });

  it("keeps sidebar slugs unique", () => {
    const slugs = getAllDocSlugs();
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
