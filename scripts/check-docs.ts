import fs from "node:fs";
import path from "node:path";
import { sidebar } from "../docs/meta/sidebar.ts";
import { buildSearchIndex } from "./build-search-index.ts";
import { parseMarkdownWithFrontmatter, walkFiles } from "./docs-utils.ts";
import { generateApiDocs } from "./generate-api-docs.ts";

const ROOT = process.cwd();
const CONTENT_DIR = path.join(ROOT, "docs/content");
const GENERATED_DIR = path.join(ROOT, "docs/generated");
const REQUIRED_FIELDS = ["title", "description", "section", "order"] as const;

function fail(message: string): never {
  throw new Error(`[docs:check] ${message}`);
}

function toSlug(baseDir: string, filePath: string): string {
  return path.relative(baseDir, filePath).replace(/\\/g, "/").replace(/\.md$/, "");
}

function validateFrontmatter(): void {
  const files = walkFiles(CONTENT_DIR, ".md");

  for (const file of files) {
    const raw = fs.readFileSync(file, "utf8");
    const parsed = parseMarkdownWithFrontmatter(raw);

    for (const field of REQUIRED_FIELDS) {
      if (!(field in parsed.frontmatter) || !parsed.frontmatter[field]) {
        fail(`Missing frontmatter field '${field}' in ${path.relative(ROOT, file)}`);
      }
    }
  }
}

function validateSidebarMappings(): void {
  const slugs = sidebar.flatMap(section => section.items.map(item => item.slug));
  const seen = new Set<string>();

  for (const slug of slugs) {
    if (seen.has(slug)) {
      fail(`Duplicate sidebar slug: ${slug}`);
    }
    seen.add(slug);

    const contentPath = path.join(CONTENT_DIR, `${slug}.md`);
    const generatedPath = path.join(GENERATED_DIR, `${slug}.md`);
    if (!fs.existsSync(contentPath) && !fs.existsSync(generatedPath)) {
      fail(`Sidebar slug has no matching markdown file: ${slug}`);
    }
  }

  const contentSlugs = walkFiles(CONTENT_DIR, ".md").map(file => toSlug(CONTENT_DIR, file));
  const generatedSlugs = walkFiles(path.join(GENERATED_DIR, "api"), ".md").map(file => `api/${toSlug(path.join(GENERATED_DIR, "api"), file)}`);

  for (const slug of [...contentSlugs, ...generatedSlugs]) {
    if (!seen.has(slug) && !slug.startsWith("api-reference/")) {
      fail(`Markdown slug is not referenced in sidebar: ${slug}`);
    }
  }
}

function validateLinks(): void {
  const files = [
    ...walkFiles(CONTENT_DIR, ".md"),
    ...walkFiles(path.join(GENERATED_DIR, "api"), ".md"),
  ];

  const validSlugs = new Set(sidebar.flatMap(section => section.items.map(item => item.slug)));

  for (const file of files) {
    const raw = fs.readFileSync(file, "utf8");
    const linkMatches = raw.matchAll(/\[[^\]]+\]\(([^)]+)\)/g);

    for (const match of linkMatches) {
      const href = match[1] ?? "";
      if (!href.startsWith("/docs/")) {
        continue;
      }
      const slug = href.slice("/docs/".length).replace(/\/$/, "");
      if (!slug) {
        continue;
      }
      if (!validSlugs.has(slug)) {
        fail(`Broken docs link '${href}' in ${path.relative(ROOT, file)}`);
      }
    }
  }
}

function validateGeneratedFreshness(): void {
  const apiFiles = walkFiles(path.join(GENERATED_DIR, "api"), ".md");
  const before = new Map(apiFiles.map(file => [file, fs.readFileSync(file, "utf8")]));

  generateApiDocs();

  for (const [file, previous] of before) {
    const next = fs.readFileSync(file, "utf8");
    if (next !== previous) {
      fail(`Generated API docs are stale: ${path.relative(ROOT, file)}`);
    }
  }

  const expectedIndex = JSON.stringify(buildSearchIndex(), null, 2);
  const searchIndexFile = path.join(GENERATED_DIR, "search-index.json");
  const currentIndex = fs.existsSync(searchIndexFile) ? fs.readFileSync(searchIndexFile, "utf8") : "";
  if (expectedIndex !== currentIndex) {
    fail("Search index is stale. Run `bun run scripts/build-search-index.ts`.");
  }
}

function run(): void {
  validateFrontmatter();
  validateSidebarMappings();
  validateLinks();
  validateGeneratedFreshness();
  // eslint-disable-next-line no-console
  console.log("[docs:check] OK");
}

run();
