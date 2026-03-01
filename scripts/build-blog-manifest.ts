import path from "node:path";
import { toAbsoluteUrl } from "../app/lib/site.ts";
import { renderMarkdownHtml, extractHeadingEntriesFromHtml, markdownToText, parseMarkdownWithFrontmatter, parseTags, walkFiles } from "./docs-utils.ts";

export interface BlogManifestEntry {
  slug: string;
  title: string;
  description: string;
  author: string;
  publishedAt: string;
  publishedLabel: string;
  tags: string[];
  excerpt: string;
  readingMinutes: number;
  canonicalUrl: string;
  headings: Array<{
    text: string;
    id: string;
    depth: number;
  }>;
  prevSlug?: string;
  nextSlug?: string;
}

interface BuildBlogManifestOptions {
  blogDir?: string;
}

const ROOT = process.cwd();
const BLOG_DIR = path.join(ROOT, "app/routes/blog");
const OUTPUT_FILE = path.join(BLOG_DIR, "blog-manifest.json");
const REQUIRED_FIELDS = ["title", "description", "section", "author", "publishedAt", "tags"] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toSlug(baseDir: string, filePath: string): string {
  return path.relative(baseDir, filePath).replace(/\\/g, "/").replace(/\.md$/, "");
}

function formatPublishedLabel(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function readingMinutesFromText(text: string): number {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 220));
}

function validateFrontmatter(
  frontmatter: Record<string, string>,
  filePath: string,
  baseDir: string,
): void {
  const relativePath = path.relative(baseDir, filePath).replace(/\\/g, "/");

  for (const field of REQUIRED_FIELDS) {
    if (!frontmatter[field]) {
      throw new Error(`[blog-manifest] Missing frontmatter field '${field}' in ${relativePath}`);
    }
  }

  if (frontmatter.section !== "Blog") {
    throw new Error(`[blog-manifest] Invalid section in ${relativePath}: expected 'Blog'`);
  }

  if (!DATE_RE.test(frontmatter.publishedAt ?? "")) {
    throw new Error(`[blog-manifest] Invalid publishedAt in ${relativePath}: expected YYYY-MM-DD`);
  }
}

async function fileToEntry(blogDir: string, filePath: string): Promise<BlogManifestEntry> {
  const raw = await Bun.file(filePath).text();
  const parsed = parseMarkdownWithFrontmatter(raw);
  validateFrontmatter(parsed.frontmatter, filePath, blogDir);

  const html = renderMarkdownHtml(parsed);
  const headings = extractHeadingEntriesFromHtml(html).filter(heading => heading.depth >= 2);
  const text = markdownToText(parsed.body);
  const slug = toSlug(blogDir, filePath);
  const publishedAt = parsed.frontmatter.publishedAt!;
  const description = parsed.frontmatter.description!;

  return {
    slug,
    title: parsed.frontmatter.title!,
    description,
    author: parsed.frontmatter.author!,
    publishedAt,
    publishedLabel: formatPublishedLabel(publishedAt),
    tags: parseTags(parsed.frontmatter.tags),
    excerpt: text.slice(0, 220),
    readingMinutes: readingMinutesFromText(text),
    canonicalUrl: toAbsoluteUrl(`/blog/${slug}`),
    headings,
  };
}

export async function buildBlogManifest(
  options: BuildBlogManifestOptions = {},
): Promise<BlogManifestEntry[]> {
  const blogDir = path.resolve(options.blogDir ?? BLOG_DIR);
  const files = await walkFiles(blogDir, ".md");
  const entries = await Promise.all(files.map(filePath => fileToEntry(blogDir, filePath)));

  const sortedEntries = entries.sort((a, b) => {
    if (a.publishedAt !== b.publishedAt) {
      return b.publishedAt.localeCompare(a.publishedAt);
    }
    return a.slug.localeCompare(b.slug);
  });

  return sortedEntries.map((entry, index) => ({
    ...entry,
    prevSlug: sortedEntries[index - 1]?.slug,
    nextSlug: sortedEntries[index + 1]?.slug,
  }));
}

export async function writeBlogManifest(): Promise<void> {
  const manifest = await buildBlogManifest();
  await Bun.write(OUTPUT_FILE, JSON.stringify(manifest, null, 2));
}

if (import.meta.main) {
  writeBlogManifest().catch(error => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
}
