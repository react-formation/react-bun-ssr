import path from "node:path";
import {
  sidebar,
  type DocKind,
  type SidebarSection,
} from "../app/routes/docs/_sidebar.ts";
import {
  extractHeadingEntriesFromHtml,
  parseMarkdownWithFrontmatter,
  parseTags,
  renderMarkdownHtml,
} from "./docs-utils.ts";

export interface DocManifestEntry {
  slug: string;
  title: string;
  navTitle: string;
  description: string;
  section: string;
  kind: DocKind;
  order: number;
  tags: string[];
  headings: Array<{
    text: string;
    id: string;
    depth: number;
  }>;
  prevSlug?: string;
  nextSlug?: string;
}

interface BuildDocsManifestOptions {
  docsDir?: string;
  sidebarData?: SidebarSection[];
}

const ROOT = process.cwd();
const DOCS_DIR = path.join(ROOT, "app/routes/docs");
const OUTPUT_FILE = path.join(DOCS_DIR, "docs-manifest.json");

function sidebarItemsWithSections(sidebarData: SidebarSection[]) {
  return sidebarData.flatMap(section =>
    section.items.map(item => ({
      ...item,
      sectionTitle: section.title,
    })),
  );
}

export async function buildDocsManifest(
  options: BuildDocsManifestOptions = {},
): Promise<DocManifestEntry[]> {
  const docsDir = path.resolve(options.docsDir ?? DOCS_DIR);
  const sidebarData = options.sidebarData ?? sidebar;
  const sidebarItems = sidebarItemsWithSections(sidebarData);

  const entries = await Promise.all(
    sidebarItems.map(async (item, index) => {
      const filePath = path.join(docsDir, `${item.slug}.md`);
      const raw = await Bun.file(filePath).text();
      const parsed = parseMarkdownWithFrontmatter(raw);
      const html = renderMarkdownHtml(parsed);
      const headings = extractHeadingEntriesFromHtml(html).filter(
        heading => heading.depth >= 2,
      );

      return {
        slug: item.slug,
        title: parsed.frontmatter.title ?? item.title,
        navTitle: parsed.frontmatter.navTitle ?? item.title,
        description: parsed.frontmatter.description ?? item.description,
        section: parsed.frontmatter.section ?? item.sectionTitle,
        kind: (parsed.frontmatter.kind as DocKind | undefined) ?? item.kind,
        order: index + 1,
        tags: parseTags(parsed.frontmatter.tags),
        headings,
      } satisfies DocManifestEntry;
    }),
  );

  return entries.map((entry, index) => ({
    ...entry,
    prevSlug: entries[index - 1]?.slug,
    nextSlug: entries[index + 1]?.slug,
  }));
}

export async function writeDocsManifest(): Promise<void> {
  const manifest = await buildDocsManifest();
  await Bun.write(OUTPUT_FILE, JSON.stringify(manifest, null, 2));
}

if (import.meta.main) {
  writeDocsManifest().catch(error => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
}
