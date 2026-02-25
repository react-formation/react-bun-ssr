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

async function fileToRecord(filePath: string, baseDir: string, slugPrefix = ""): Promise<SearchRecord> {
  const raw = await Bun.file(filePath).text();
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

export async function buildSearchIndex(): Promise<SearchRecord[]> {
  const markdownFiles = await walkFiles(DOCS_ROUTES_DIR, ".md");
  const records = await Promise.all(markdownFiles.map(file => fileToRecord(file, DOCS_ROUTES_DIR)));

  return records
    .sort((a, b) => a.url.localeCompare(b.url))
    .map((record, index) => ({
      ...record,
      id: `${record.id}-${index}`,
    }));
}

export async function writeSearchIndex(): Promise<void> {
  const records = await buildSearchIndex();
  await Bun.write(OUTPUT_FILE, JSON.stringify(records, null, 2));
}

if (import.meta.main) {
  writeSearchIndex().catch(error => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
}
