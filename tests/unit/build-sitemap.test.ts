import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import { SITE_URL, toAbsoluteUrl } from "../../app/lib/site.ts";
import { ensureDir, makeTempDir, removePath, writeText } from "../../framework/runtime/io";
import {
  buildSitemap,
  ensureRobotsWithSitemap,
  renderRobotsTxt,
  renderSitemapXml,
} from "../../scripts/build-sitemap";
import type { BlogManifestEntry } from "../../scripts/build-blog-manifest";
import type { DocManifestEntry } from "../../scripts/build-docs-manifest";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => removePath(dir)));
  process.env.PATH = ORIGINAL_PATH;
});

const ORIGINAL_PATH = process.env.PATH ?? "";

async function createRoot(prefix: string): Promise<string> {
  const root = await makeTempDir(prefix);
  tempDirs.push(root);
  await ensureDir(path.join(root, "app/routes/docs"));
  await ensureDir(path.join(root, "app/routes/blog"));
  await ensureDir(path.join(root, "app/public"));
  return root;
}

async function runGit(root: string, args: string[], env?: Record<string, string>): Promise<void> {
  const result = Bun.spawnSync({
    cmd: ["git", "-C", root, ...args],
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      ...env,
    },
  });

  if (result.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(result.stderr).trim() || `git ${args.join(" ")} failed`);
  }
}

describe("buildSitemap", () => {
  it("builds docs and blog entries, excludes non-canonical routes, and sorts deterministically", async () => {
    const root = await createRoot("sitemap-build");
    const docsIndex = path.join(root, "app/routes/docs/index.tsx");
    const blogIndex = path.join(root, "app/routes/blog/index.tsx");
    await writeText(docsIndex, "export default function Docs(){ return null; }");
    await writeText(blogIndex, "export default function Blog(){ return null; }");

    const docsManifest: DocManifestEntry[] = [
      {
        slug: "start/overview",
        title: "Overview",
        navTitle: "Overview",
        description: "Overview",
        section: "Start",
        kind: "overview",
        order: 1,
        tags: [],
        headings: [],
      },
      {
        slug: "api/overview",
        title: "API",
        navTitle: "API",
        description: "API",
        section: "API",
        kind: "reference",
        order: 2,
        tags: [],
        headings: [],
      },
    ];
    const blogManifest: BlogManifestEntry[] = [
      {
        slug: "launch-post",
        title: "Launch",
        description: "Launch",
        author: "gaudiauj",
        publishedAt: "2026-03-01",
        publishedLabel: "March 1, 2026",
        tags: [],
        excerpt: "Launch excerpt",
        readingMinutes: 1,
        canonicalUrl: toAbsoluteUrl("/blog/launch-post"),
        headings: [],
      },
    ];

    await writeText(path.join(root, "app/routes/docs/start/overview.md"), "# Overview");
    await writeText(path.join(root, "app/routes/docs/api/overview.md"), "# API");
    await writeText(path.join(root, "app/routes/blog/launch-post.md"), "# Launch");

    const sitemap = await buildSitemap({
      rootDir: root,
      docsManifest,
      blogManifest,
    });

    expect(sitemap.map(entry => entry.pathname)).toEqual([
      "/blog",
      "/blog/launch-post",
      "/docs",
      "/docs/api/overview",
      "/docs/start/overview",
    ]);
    expect(sitemap.some(entry => entry.pathname === "/")).toBe(false);
    expect(sitemap.some(entry => entry.pathname.startsWith("/api/"))).toBe(false);
    expect(sitemap.some(entry => entry.pathname === "/router-playground")).toBe(false);
    expect(sitemap.every(entry => entry.absoluteUrl.startsWith(`${SITE_URL}/`))).toBe(true);

    const xml = renderSitemapXml(sitemap);
    expect(xml).toContain(`<loc>${toAbsoluteUrl("/docs")}</loc>`);
    expect(xml).toContain(`<loc>${toAbsoluteUrl("/blog/launch-post")}</loc>`);
  });

  it("uses git-backed lastmod when available", async () => {
    const root = await createRoot("sitemap-git");
    const docsIndex = path.join(root, "app/routes/docs/index.tsx");
    const blogIndex = path.join(root, "app/routes/blog/index.tsx");
    const overviewFile = path.join(root, "app/routes/docs/start/overview.md");

    await writeText(docsIndex, "export default function Docs(){ return null; }");
    await writeText(blogIndex, "export default function Blog(){ return null; }");
    await writeText(overviewFile, "# Overview");

    await runGit(root, ["init"]);
    await runGit(root, ["config", "user.email", "test@example.com"]);
    await runGit(root, ["config", "user.name", "Test User"]);
    await runGit(root, ["add", "."]);
    await runGit(root, ["commit", "-m", "initial"], {
      GIT_AUTHOR_DATE: "2026-02-20T10:00:00Z",
      GIT_COMMITTER_DATE: "2026-02-20T10:00:00Z",
    });

    const sitemap = await buildSitemap({
      rootDir: root,
      docsManifest: [
        {
          slug: "start/overview",
          title: "Overview",
          navTitle: "Overview",
          description: "Overview",
          section: "Start",
          kind: "overview",
          order: 1,
          tags: [],
          headings: [],
        },
      ],
      blogManifest: [],
    });

    const overviewEntry = sitemap.find(entry => entry.pathname === "/docs/start/overview");
    expect(new Date(overviewEntry?.lastmod ?? "").toISOString()).toBe("2026-02-20T10:00:00.000Z");
  });

  it("falls back to filesystem mtime when git metadata is unavailable", async () => {
    const root = await createRoot("sitemap-fallback");
    const docsIndex = path.join(root, "app/routes/docs/index.tsx");
    const blogIndex = path.join(root, "app/routes/blog/index.tsx");
    await writeText(docsIndex, "export default function Docs(){ return null; }");
    await writeText(blogIndex, "export default function Blog(){ return null; }");

    const sitemap = await buildSitemap({
      rootDir: root,
      docsManifest: [],
      blogManifest: [],
    });

    expect(sitemap[0]?.pathname).toBe("/blog");
    expect(sitemap[0]?.lastmod).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("falls back to filesystem mtime when git is not installed", async () => {
    const root = await createRoot("sitemap-no-git");
    const docsIndex = path.join(root, "app/routes/docs/index.tsx");
    const blogIndex = path.join(root, "app/routes/blog/index.tsx");
    await writeText(docsIndex, "export default function Docs(){ return null; }");
    await writeText(blogIndex, "export default function Blog(){ return null; }");

    process.env.PATH = "";

    const sitemap = await buildSitemap({
      rootDir: root,
      docsManifest: [],
      blogManifest: [],
    });

    expect(sitemap[0]?.pathname).toBe("/blog");
    expect(sitemap[0]?.lastmod).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("ensureRobotsWithSitemap", () => {
  it("creates robots.txt when absent", async () => {
    const root = await createRoot("robots-create");

    await ensureRobotsWithSitemap({ rootDir: root });

    const robots = await Bun.file(path.join(root, "app/public/robots.txt")).text();
    expect(robots).toContain("User-agent: *");
    expect(robots).toContain("Allow: /");
    expect(robots).toContain(`Sitemap: ${toAbsoluteUrl("/sitemap.xml")}`);
  });

  it("appends sitemap when missing and replaces stale lines", async () => {
    const root = await createRoot("robots-update");
    const robotsFile = path.join(root, "app/public/robots.txt");
    await writeText(robotsFile, "User-agent: *\nDisallow: /private\n\nSitemap: https://example.com/old.xml\n");

    await ensureRobotsWithSitemap({ rootDir: root });

    const robots = await Bun.file(robotsFile).text();
    expect(robots).toContain("User-agent: *");
    expect(robots).toContain("Disallow: /private");
    expect(robots).toContain(`Sitemap: ${toAbsoluteUrl("/sitemap.xml")}`);
    expect(robots).not.toContain("https://example.com/old.xml");
    expect(robots).toBe(renderRobotsTxt(robots));
  });
});
