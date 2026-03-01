import path from "node:path";
import { existsPath, readText, statPath, writeText } from "../framework/runtime/io";
import { SITE_URL, toAbsoluteUrl } from "../app/lib/site.ts";
import { buildBlogManifest, type BlogManifestEntry } from "./build-blog-manifest.ts";
import { buildDocsManifest, type DocManifestEntry } from "./build-docs-manifest.ts";

const ROOT = process.cwd();
const DOCS_DIR = path.join(ROOT, "app/routes/docs");
const BLOG_DIR = path.join(ROOT, "app/routes/blog");
const PUBLIC_DIR = path.join(ROOT, "app/public");
const SITEMAP_FILE = path.join(PUBLIC_DIR, "sitemap.xml");
const ROBOTS_FILE = path.join(PUBLIC_DIR, "robots.txt");
const SITEMAP_URL = toAbsoluteUrl("/sitemap.xml");

export interface SitemapEntry {
  pathname: string;
  absoluteUrl: string;
  lastmod: string;
  sourceFile: string;
}

export interface BuildSitemapOptions {
  rootDir?: string;
  docsDir?: string;
  blogDir?: string;
  publicDir?: string;
  docsManifest?: DocManifestEntry[];
  blogManifest?: BlogManifestEntry[];
}

function toPosixPath(value: string): string {
  return value.replace(/\\/g, "/");
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function resolvePaths(options: BuildSitemapOptions) {
  const rootDir = path.resolve(options.rootDir ?? ROOT);
  const docsDir = path.resolve(options.docsDir ?? path.join(rootDir, "app/routes/docs"));
  const blogDir = path.resolve(options.blogDir ?? path.join(rootDir, "app/routes/blog"));
  const publicDir = path.resolve(options.publicDir ?? path.join(rootDir, "app/public"));

  return {
    rootDir,
    docsDir,
    blogDir,
    publicDir,
    docsIndexFile: path.join(rootDir, "app/routes/docs/index.tsx"),
    blogIndexFile: path.join(rootDir, "app/routes/blog/index.tsx"),
    sitemapFile: path.join(publicDir, "sitemap.xml"),
    robotsFile: path.join(publicDir, "robots.txt"),
  };
}

async function resolveLastmod(filePath: string, rootDir: string): Promise<string> {
  const relativePath = toPosixPath(path.relative(rootDir, filePath));
  try {
    const gitResult = Bun.spawnSync({
      cmd: ["git", "-C", rootDir, "log", "-1", "--format=%cI", "--", relativePath],
      stdout: "pipe",
      stderr: "pipe",
    });

    if (gitResult.exitCode === 0) {
      const value = new TextDecoder().decode(gitResult.stdout).trim();
      if (value) {
        return value;
      }
    }
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String(error.code) : "";
    if (code !== "ENOENT") {
      throw error;
    }
  }

  const stat = await statPath(filePath);
  if (!stat) {
    throw new Error(`[sitemap] Cannot determine last modification time for ${relativePath}`);
  }

  return new Date(stat.mtime).toISOString();
}

function defaultRobotsTxt(): string {
  return `User-agent: *
Allow: /

Sitemap: ${SITEMAP_URL}
`;
}

export function renderRobotsTxt(existing: string | null | undefined): string {
  if (existing == null) {
    return defaultRobotsTxt();
  }

  const lines = existing.replace(/\r\n/g, "\n").split("\n");
  const kept = lines.filter(line => !/^sitemap:/i.test(line.trim()));

  while (kept.length > 0 && kept[kept.length - 1]!.trim() === "") {
    kept.pop();
  }

  if (kept.length === 0) {
    return `Sitemap: ${SITEMAP_URL}\n`;
  }

  return `${kept.join("\n")}\n\nSitemap: ${SITEMAP_URL}\n`;
}

export function renderSitemapXml(entries: SitemapEntry[]): string {
  const body = entries
    .map(entry => `  <url>
    <loc>${escapeXml(entry.absoluteUrl)}</loc>
    <lastmod>${escapeXml(entry.lastmod)}</lastmod>
  </url>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

export async function buildSitemap(options: BuildSitemapOptions = {}): Promise<SitemapEntry[]> {
  const paths = resolvePaths(options);
  const docsManifest = options.docsManifest ?? await buildDocsManifest({ docsDir: paths.docsDir });
  const blogManifest = options.blogManifest ?? await buildBlogManifest({ blogDir: paths.blogDir });

  const rawEntries: Array<{ pathname: string; sourceFile: string }> = [
    {
      pathname: "/docs",
      sourceFile: paths.docsIndexFile,
    },
    ...docsManifest.map(entry => ({
      pathname: `/docs/${entry.slug}`,
      sourceFile: path.join(paths.docsDir, `${entry.slug}.md`),
    })),
    {
      pathname: "/blog",
      sourceFile: paths.blogIndexFile,
    },
    ...blogManifest.map(entry => ({
      pathname: `/blog/${entry.slug}`,
      sourceFile: path.join(paths.blogDir, `${entry.slug}.md`),
    })),
  ];

  const sortedEntries = rawEntries
    .sort((a, b) => a.pathname.localeCompare(b.pathname));

  return Promise.all(
    sortedEntries.map(async entry => ({
      pathname: entry.pathname,
      absoluteUrl: toAbsoluteUrl(entry.pathname),
      lastmod: await resolveLastmod(entry.sourceFile, paths.rootDir),
      sourceFile: entry.sourceFile,
    })),
  );
}

export async function ensureRobotsWithSitemap(options: BuildSitemapOptions = {}): Promise<void> {
  const { robotsFile } = resolvePaths(options);
  const existing = await existsPath(robotsFile) ? await readText(robotsFile) : null;
  await writeText(robotsFile, renderRobotsTxt(existing));
}

export async function writeSitemap(options: BuildSitemapOptions = {}): Promise<void> {
  const { sitemapFile } = resolvePaths(options);
  const entries = await buildSitemap(options);
  await writeText(sitemapFile, renderSitemapXml(entries));
  await ensureRobotsWithSitemap(options);
}

if (import.meta.main) {
  writeSitemap().catch(error => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
}
