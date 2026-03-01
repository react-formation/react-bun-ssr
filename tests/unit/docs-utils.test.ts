import { describe, expect, it } from "bun:test";
import {
  extractHeadingEntriesFromHtml,
  extractHeadings,
  parseMarkdownWithFrontmatter,
  renderMarkdownHtml,
  tokenize,
} from "../../scripts/docs-utils";

describe("docs utils", () => {
  it("parses frontmatter and body", () => {
    const input = `---\ntitle: Hello\nnavTitle: Hello\ndescription: World\nsection: Test\norder: 1\nkind: guide\n---\n\n# H1\nBody`;
    const parsed = parseMarkdownWithFrontmatter(input);

    expect(parsed.frontmatter.title).toBe("Hello");
    expect(parsed.body).toContain("# H1");
  });

  it("extracts markdown headings", () => {
    const headings = extractHeadings(`# One\n## Two\ntext\n### Three`);
    expect(headings).toEqual(["One", "Two", "Three"]);
  });

  it("renders markdown html with heading ids", () => {
    const parsed = parseMarkdownWithFrontmatter(`---\ntitle: Hello\nnavTitle: Hello\ndescription: World\nsection: Test\norder: 1\nkind: guide\n---\n\n# Hello\n\n## First section\n\n### Nested bits`);
    const html = renderMarkdownHtml(parsed);
    expect(html).toContain('id="first-section"');
    expect(extractHeadingEntriesFromHtml(html)).toEqual([
      { text: "First section", id: "first-section", depth: 2 },
      { text: "Nested bits", id: "nested-bits", depth: 3 },
    ]);
  });

  it("tokenizes text deterministically", () => {
    expect(tokenize("Hello, SSR Bun SSR")).toEqual(["hello", "ssr", "bun"]);
  });
});
