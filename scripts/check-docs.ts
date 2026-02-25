import path from "node:path";
import { sidebar } from "../app/routes/docs/_sidebar.ts";
import { buildSearchIndex } from "./build-search-index.ts";
import { parseMarkdownWithFrontmatter, walkFiles } from "./docs-utils.ts";
import { generateApiDocs } from "./generate-api-docs.ts";

const ROOT = process.cwd();
const DOCS_ROUTES_DIR = path.join(ROOT, "app/routes/docs");
const API_DIR = path.join(DOCS_ROUTES_DIR, "api");
const REQUIRED_FIELDS = ["title", "description", "section", "order"] as const;
const SOURCE_DIRS = ["framework", "scripts", "tests", "app", "bin"] as const;
const SOURCE_FILE_PATTERN = "**/*.{ts,tsx,js,jsx,mjs,cjs}";
const ALLOWED_NODE_IMPORTS = new Set(["path", "fs"]);
const WATCHER_FILE = "framework/cli/commands.ts";

function fail(message: string): never {
  throw new Error(`[docs:check] ${message}`);
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

    for (const field of REQUIRED_FIELDS) {
      if (!(field in parsed.frontmatter) || !parsed.frontmatter[field]) {
        fail(`Missing frontmatter field '${field}' in ${path.relative(ROOT, file)}`);
      }
    }
  }
}

async function validateSidebarMappings(): Promise<void> {
  const slugs = sidebar.flatMap(section => section.items.map(item => item.slug));
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

  const routeSlugs = (await walkFiles(DOCS_ROUTES_DIR, ".md"))
    .map(file => toSlug(DOCS_ROUTES_DIR, file));

  for (const slug of routeSlugs) {
    if (!seen.has(slug) && !slug.startsWith("api-reference/")) {
      fail(`Markdown slug is not referenced in sidebar: ${slug}`);
    }
  }
}

async function validateLinks(): Promise<void> {
  const files = await walkFiles(DOCS_ROUTES_DIR, ".md");

  const validSlugs = new Set(sidebar.flatMap(section => section.items.map(item => item.slug)));

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

async function validateGeneratedFreshness(): Promise<void> {
  const apiFiles = await walkFiles(API_DIR, ".md");
  const before = new Map(
    await Promise.all(
      apiFiles.map(async file => [file, await Bun.file(file).text()] as const),
    ),
  );

  await generateApiDocs();

  for (const [file, previous] of before) {
    const next = await Bun.file(file).text();
    if (next !== previous) {
      fail(`Generated API docs are stale: ${path.relative(ROOT, file)}`);
    }
  }

  const expectedIndex = JSON.stringify(await buildSearchIndex(), null, 2);
  const searchIndexFile = path.join(DOCS_ROUTES_DIR, "search-index.json");
  const currentIndex = (await Bun.file(searchIndexFile).exists())
    ? await Bun.file(searchIndexFile).text()
    : "";
  if (expectedIndex !== currentIndex) {
    fail("Search index is stale. Run `bun run scripts/build-search-index.ts`.");
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
  await validateSidebarMappings();
  await validateLinks();
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
