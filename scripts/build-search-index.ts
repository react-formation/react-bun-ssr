import path from "node:path";
import { buildDocsManifest, type DocManifestEntry } from "./build-docs-manifest.ts";
import {
  markdownToText,
  parseMarkdownWithFrontmatter,
  tokenize,
} from "./docs-utils.ts";

interface SearchRecord {
  id: string;
  title: string;
  navTitle: string;
  section: string;
  kind: "overview" | "guide" | "reference" | "api" | "migration";
  excerpt: string;
  url: string;
  tags: string[];
  headings: Array<{
    text: string;
    id: string;
    depth: number;
  }>;
  tokens: string[];
}

const ROOT = process.cwd();
const DOCS_ROUTES_DIR = path.join(ROOT, "app/routes/docs");
const OUTPUT_FILE = path.join(DOCS_ROUTES_DIR, "search-index.json");

async function manifestEntryToRecord(entry: DocManifestEntry): Promise<SearchRecord> {
  const filePath = path.join(DOCS_ROUTES_DIR, `${entry.slug}.md`);
  const raw = await Bun.file(filePath).text();
  const parsed = parseMarkdownWithFrontmatter(raw);
  const text = markdownToText(parsed.body);
  const excerpt = text.slice(0, 220);

  return {
    id: entry.slug,
    title: entry.title,
    navTitle: entry.navTitle,
    section: entry.section,
    kind: entry.kind,
    excerpt,
    url: `/docs/${entry.slug}`,
    tags: entry.tags,
    headings: entry.headings,
    tokens: tokenize(
      [
        entry.title,
        entry.navTitle,
        entry.description,
        entry.section,
        entry.kind,
        entry.tags.join(" "),
        entry.headings.map(heading => heading.text).join(" "),
        text,
      ].join(" "),
    ),
  };
}

export async function buildSearchIndex(): Promise<SearchRecord[]> {
  const manifest = await buildDocsManifest();
  const records = await Promise.all(manifest.map(manifestEntryToRecord));

  return records.map((record, index) => ({
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
