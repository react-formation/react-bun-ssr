import { describe, expect, it } from "bun:test";
import {
  extractHeadings,
  parseMarkdownWithFrontmatter,
  tokenize,
} from "../../scripts/docs-utils";

describe("docs utils", () => {
  it("parses frontmatter and body", () => {
    const input = `---\ntitle: Hello\ndescription: World\nsection: Test\norder: 1\n---\n\n# H1\nBody`;
    const parsed = parseMarkdownWithFrontmatter(input);

    expect(parsed.frontmatter.title).toBe("Hello");
    expect(parsed.body).toContain("# H1");
  });

  it("extracts markdown headings", () => {
    const headings = extractHeadings(`# One\n## Two\ntext\n### Three`);
    expect(headings).toEqual(["One", "Two", "Three"]);
  });

  it("tokenizes text deterministically", () => {
    expect(tokenize("Hello, SSR Bun SSR")).toEqual(["hello", "ssr", "bun"]);
  });
});
