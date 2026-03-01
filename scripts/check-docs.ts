import path from "node:path";
import { flattenSidebarSlugs, sidebar } from "../app/routes/docs/_sidebar.ts";
import { buildBlogManifest } from "./build-blog-manifest.ts";
import { buildDocsManifest } from "./build-docs-manifest.ts";
import { buildSearchIndex } from "./build-search-index.ts";
import { buildSitemap, renderRobotsTxt, renderSitemapXml } from "./build-sitemap.ts";
import { parseMarkdownWithFrontmatter, walkFiles } from "./docs-utils.ts";
import { generateApiDocs } from "./generate-api-docs.ts";

const ROOT = process.cwd();
const DOCS_ROUTES_DIR = path.join(ROOT, "app/routes/docs");
const BLOG_ROUTES_DIR = path.join(ROOT, "app/routes/blog");
const API_DIR = path.join(DOCS_ROUTES_DIR, "api");
const PUBLIC_DIR = path.join(ROOT, "app/public");
const SITEMAP_FILE = path.join(PUBLIC_DIR, "sitemap.xml");
const ROBOTS_FILE = path.join(PUBLIC_DIR, "robots.txt");
const DOC_REQUIRED_FIELDS = ["title", "navTitle", "description", "section", "order", "kind"] as const;
const BLOG_REQUIRED_FIELDS = ["title", "description", "section", "author", "publishedAt", "tags"] as const;
const SOURCE_DIRS = ["framework", "scripts", "tests", "app", "bin"] as const;
const SOURCE_FILE_PATTERN = "**/*.{ts,tsx,js,jsx,mjs,cjs}";
const ALLOWED_NODE_IMPORTS = new Set(["path", "fs"]);
const WATCHER_FILE = "framework/cli/commands.ts";
const BLOG_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function fail(message: string): never {
  throw new Error(`[docs:check] ${message}`);
}

function normalizeSitemapForFreshness(value: string): string {
  return value.replace(/<lastmod>[^<]+<\/lastmod>/g, "<lastmod>__DYNAMIC__</lastmod>");
}

function toSlug(baseDir: string, filePath: string): string {
  return path.relative(baseDir, filePath).replace(/\\/g, "/").replace(/\.md$/, "");
}

async function isDirectory(dirPath: string): Promise<boolean> {
  try {
    return (await Bun.file(dirPath).stat()).isDirectory();
  } catch (error) {
    if (
      error
      && typeof error === "object"
      && "code" in error
      && (error as { code?: unknown }).code === "ENOENT"
    ) {
      return false;
    }
    throw error;
  }
}

async function getSourceFiles(): Promise<string[]> {
  const files: string[] = [];
  for (const sourceDir of SOURCE_DIRS) {
    const absoluteDir = path.join(ROOT, sourceDir);
    if (!(await isDirectory(absoluteDir))) {
      continue;
    }

    const scanner = new Bun.Glob(SOURCE_FILE_PATTERN);
    for await (const filePath of scanner.scan({ cwd: absoluteDir, absolute: true, dot: true })) {
      files.push(path.resolve(filePath));
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

async function validateFrontmatter(): Promise<void> {
  const files = await walkFiles(DOCS_ROUTES_DIR, ".md");

  for (const file of files) {
    const raw = await Bun.file(file).text();
    const parsed = parseMarkdownWithFrontmatter(raw);

    for (const field of DOC_REQUIRED_FIELDS) {
      if (!(field in parsed.frontmatter) || !parsed.frontmatter[field]) {
        fail(`Missing frontmatter field '${field}' in ${path.relative(ROOT, file)}`);
      }
    }
  }
}

async function validateBlogFrontmatter(): Promise<void> {
  const files = await walkFiles(BLOG_ROUTES_DIR, ".md");

  for (const file of files) {
    const raw = await Bun.file(file).text();
    const parsed = parseMarkdownWithFrontmatter(raw);

    for (const field of BLOG_REQUIRED_FIELDS) {
      if (!(field in parsed.frontmatter) || !parsed.frontmatter[field]) {
        fail(`Missing blog frontmatter field '${field}' in ${path.relative(ROOT, file)}`);
      }
    }

    if (parsed.frontmatter.section !== "Blog") {
      fail(`Blog markdown must use section: Blog in ${path.relative(ROOT, file)}`);
    }

    if (!BLOG_DATE_RE.test(parsed.frontmatter.publishedAt ?? "")) {
      fail(`Blog markdown publishedAt must use YYYY-MM-DD in ${path.relative(ROOT, file)}`);
    }
  }
}

async function validateSidebarMappings(): Promise<void> {
  const slugs = flattenSidebarSlugs();
  const seen = new Set<string>();

  for (const slug of slugs) {
    if (seen.has(slug)) {
      fail(`Duplicate sidebar slug: ${slug}`);
    }
    seen.add(slug);

    const markdownPath = path.join(DOCS_ROUTES_DIR, `${slug}.md`);
    if (!(await Bun.file(markdownPath).exists())) {
      fail(`Sidebar slug has no matching markdown file: ${slug}`);
    }
  }

  const routeSlugs = (await walkFiles(DOCS_ROUTES_DIR, ".md")).map(file => toSlug(DOCS_ROUTES_DIR, file));

  for (const slug of routeSlugs) {
    if (!seen.has(slug)) {
      fail(`Markdown slug is not referenced in sidebar: ${slug}`);
    }
  }
}

async function validateLinks(): Promise<void> {
  const files = await walkFiles(DOCS_ROUTES_DIR, ".md");
  const validSlugs = new Set(flattenSidebarSlugs());

  for (const file of files) {
    const raw = await Bun.file(file).text();
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

async function validateBlogLinks(): Promise<void> {
  const files = await walkFiles(BLOG_ROUTES_DIR, ".md");
  const validDocsSlugs = new Set(flattenSidebarSlugs());
  const validBlogSlugs = new Set(
    (await walkFiles(BLOG_ROUTES_DIR, ".md")).map(file => toSlug(BLOG_ROUTES_DIR, file)),
  );

  for (const file of files) {
    const raw = await Bun.file(file).text();
    const linkMatches = raw.matchAll(/\[[^\]]+\]\(([^)]+)\)/g);

    for (const match of linkMatches) {
      const href = match[1] ?? "";

      if (href.startsWith("/docs/")) {
        const slug = href.slice("/docs/".length).replace(/\/$/, "");
        if (slug && !validDocsSlugs.has(slug)) {
          fail(`Broken docs link '${href}' in ${path.relative(ROOT, file)}`);
        }
        continue;
      }

      if (href.startsWith("/blog/")) {
        const slug = href.slice("/blog/".length).replace(/\/$/, "");
        if (slug && !validBlogSlugs.has(slug)) {
          fail(`Broken blog link '${href}' in ${path.relative(ROOT, file)}`);
        }
      }
    }
  }
}

async function validateGeneratedFreshness(): Promise<void> {
  const apiFiles = await walkFiles(API_DIR, ".md");
  const before = new Map(
    await Promise.all(apiFiles.map(async file => [file, await Bun.file(file).text()] as const)),
  );

  await generateApiDocs();

  for (const [file, previous] of before) {
    const next = await Bun.file(file).text();
    if (next !== previous) {
      fail(`Generated API docs are stale: ${path.relative(ROOT, file)}`);
    }
  }

  const expectedManifest = JSON.stringify(await buildDocsManifest(), null, 2);
  const manifestFile = path.join(DOCS_ROUTES_DIR, "docs-manifest.json");
  const currentManifest = (await Bun.file(manifestFile).exists())
    ? await Bun.file(manifestFile).text()
    : "";
  if (expectedManifest !== currentManifest) {
    fail("Docs manifest is stale. Run `bun run scripts/build-docs-manifest.ts`.");
  }

  const expectedIndex = JSON.stringify(await buildSearchIndex(), null, 2);
  const searchIndexFile = path.join(DOCS_ROUTES_DIR, "search-index.json");
  const currentIndex = (await Bun.file(searchIndexFile).exists())
    ? await Bun.file(searchIndexFile).text()
    : "";
  if (expectedIndex !== currentIndex) {
    fail("Search index is stale. Run `bun run scripts/build-search-index.ts`.");
  }

  const expectedBlogManifest = JSON.stringify(await buildBlogManifest(), null, 2);
  const blogManifestFile = path.join(BLOG_ROUTES_DIR, "blog-manifest.json");
  const currentBlogManifest = (await Bun.file(blogManifestFile).exists())
    ? await Bun.file(blogManifestFile).text()
    : "";
  if (expectedBlogManifest !== currentBlogManifest) {
    fail("Blog manifest is stale. Run `bun run scripts/build-blog-manifest.ts`.");
  }

  const expectedSitemap = renderSitemapXml(await buildSitemap());
  const currentSitemap = (await Bun.file(SITEMAP_FILE).exists())
    ? await Bun.file(SITEMAP_FILE).text()
    : "";
  if (normalizeSitemapForFreshness(expectedSitemap) !== normalizeSitemapForFreshness(currentSitemap)) {
    fail("Sitemap is stale. Run `bun run scripts/build-sitemap.ts`.");
  }

  if (!(await Bun.file(ROBOTS_FILE).exists())) {
    fail("robots.txt is missing. Run `bun run scripts/build-sitemap.ts`.");
  }
  const currentRobots = await Bun.file(ROBOTS_FILE).text();
  const expectedRobots = renderRobotsTxt(currentRobots);
  if (expectedRobots !== currentRobots) {
    fail("robots.txt sitemap linkage is stale. Run `bun run scripts/build-sitemap.ts`.");
  }
}

async function validateNodeApiPolicy(): Promise<void> {
  const files = await getSourceFiles();
  const disallowedFsPromises: string[] = [];
  const disallowedOs: string[] = [];
  const disallowedNodeImports: string[] = [];

  for (const filePath of files) {
    const relativePath = path.relative(ROOT, filePath).replace(/\\/g, "/");
    const source = await Bun.file(filePath).text();

    const importMatches = source.matchAll(/import\s+[^;]+from\s+["']node:([^"']+)["']/g);
    for (const match of importMatches) {
      const moduleName = match[1] ?? "";
      const statement = match[0] ?? "";

      if (moduleName === "fs/promises") {
        disallowedFsPromises.push(relativePath);
        continue;
      }

      if (moduleName === "os") {
        disallowedOs.push(relativePath);
        continue;
      }

      if (!ALLOWED_NODE_IMPORTS.has(moduleName)) {
        disallowedNodeImports.push(`${relativePath} -> node:${moduleName}`);
        continue;
      }

      if (
        moduleName === "fs"
        && (relativePath !== WATCHER_FILE || !statement.includes("watch"))
      ) {
        disallowedNodeImports.push(`${relativePath} -> node:fs (only watch in ${WATCHER_FILE} is allowed)`);
      }
    }
  }

  if (disallowedFsPromises.length > 0) {
    fail(
      `node:fs/promises imports are disallowed:\n${disallowedFsPromises
        .map(file => `- ${file}`)
        .join("\n")}`,
    );
  }

  if (disallowedOs.length > 0) {
    fail(
      `node:os imports are disallowed:\n${disallowedOs
        .map(file => `- ${file}`)
        .join("\n")}`,
    );
  }

  if (disallowedNodeImports.length > 0) {
    fail(
      `Disallowed node:* imports found:\n${disallowedNodeImports
        .map(line => `- ${line}`)
        .join("\n")}`,
    );
  }
}

async function run(): Promise<void> {
  await validateFrontmatter();
  await validateBlogFrontmatter();
  await validateSidebarMappings();
  await validateLinks();
  await validateBlogLinks();
  await validateGeneratedFreshness();
  await validateNodeApiPolicy();
  // eslint-disable-next-line no-console
  console.log("[docs:check] OK");
}

run().catch(error => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
