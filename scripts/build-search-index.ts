import fs from "node:fs";
import path from "node:path";
import {
  extractHeadings,
  markdownToText,
  parseMarkdownWithFrontmatter,
  tokenize,
  walkFiles,
} from "./docs-utils.ts";

interface SearchRecord {
  id: string;
  title: string;
  section: string;
  headings: string[];
  excerpt: string;
  url: string;
  tokens: string[];
}

const ROOT = process.cwd();
const DOCS_ROUTES_DIR = path.join(ROOT, "app/routes/docs");
const OUTPUT_FILE = path.join(DOCS_ROUTES_DIR, "search-index.json");

function toSlug(filePath: string, baseDir: string): string {
  const relative = path.relative(baseDir, filePath).replace(/\\/g, "/");
  return relative.replace(/\.md$/, "");
}

function fileToRecord(filePath: string, baseDir: string, slugPrefix = ""): SearchRecord {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = parseMarkdownWithFrontmatter(raw);
  const slug = `${slugPrefix}${toSlug(filePath, baseDir)}`;
  const headings = extractHeadings(parsed.body);
  const text = markdownToText(parsed.body);

  return {
    id: slug,
    title: parsed.frontmatter.title ?? slug,
    section: parsed.frontmatter.section ?? "Docs",
    headings,
    excerpt: text.slice(0, 180),
    url: `/docs/${slug}`,
    tokens: tokenize([parsed.frontmatter.title ?? "", text, headings.join(" ")].join(" ")),
  };
}

export function buildSearchIndex(): SearchRecord[] {
  const markdownFiles = walkFiles(DOCS_ROUTES_DIR, ".md");
  const records = markdownFiles.map(file => fileToRecord(file, DOCS_ROUTES_DIR));

  return records
    .sort((a, b) => a.url.localeCompare(b.url))
    .map((record, index) => ({
      ...record,
      id: `${record.id}-${index}`,
    }));
}

export function writeSearchIndex(): void {
  const records = buildSearchIndex();
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(records, null, 2), "utf8");
}

if (import.meta.main) {
  writeSearchIndex();
}
