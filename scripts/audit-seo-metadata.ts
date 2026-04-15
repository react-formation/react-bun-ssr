import path from "node:path";
import { parseMarkdownWithFrontmatter, walkFiles } from "./docs-utils.ts";

const ROOT = process.cwd();
const DOCS_ROUTES_DIR = path.join(ROOT, "app/routes/docs");
const BLOG_ROUTES_DIR = path.join(ROOT, "app/routes/blog");
const MIN_TITLE_LENGTH = 35;
const MAX_TITLE_LENGTH = 70;
const MIN_DESCRIPTION_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 170;

interface MetadataIssue {
  file: string;
  field: "title" | "description";
  length: number;
  expected: string;
  value: string;
}

function relativePath(filePath: string): string {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function auditLength(options: {
  issues: MetadataIssue[];
  file: string;
  field: MetadataIssue["field"];
  value: string | undefined;
  min: number;
  max: number;
}): void {
  const value = options.value?.trim() ?? "";
  if (value.length < options.min) {
    options.issues.push({
      file: relativePath(options.file),
      field: options.field,
      length: value.length,
      expected: `>= ${options.min}`,
      value,
    });
    return;
  }

  if (value.length > options.max) {
    options.issues.push({
      file: relativePath(options.file),
      field: options.field,
      length: value.length,
      expected: `<= ${options.max}`,
      value,
    });
  }
}

async function auditMarkdownRoutes(rootDir: string): Promise<MetadataIssue[]> {
  const files = await walkFiles(rootDir, ".md");
  const issueGroups = await Promise.all(files.map(async file => {
    const parsed = parseMarkdownWithFrontmatter(await Bun.file(file).text());
    const issues: MetadataIssue[] = [];

    auditLength({
      issues,
      file,
      field: "title",
      value: parsed.frontmatter.title,
      min: MIN_TITLE_LENGTH,
      max: MAX_TITLE_LENGTH,
    });
    auditLength({
      issues,
      file,
      field: "description",
      value: parsed.frontmatter.description,
      min: MIN_DESCRIPTION_LENGTH,
      max: MAX_DESCRIPTION_LENGTH,
    });

    return issues;
  }));

  return issueGroups.flat().sort((a, b) => {
    const fileOrder = a.file.localeCompare(b.file);
    return fileOrder || a.field.localeCompare(b.field);
  });
}

function printIssues(issues: MetadataIssue[]): void {
  if (issues.length === 0) {
    console.log("[seo:audit] Metadata lengths look good.");
    return;
  }

  console.log(`[seo:audit] Found ${issues.length} metadata length issue(s).`);
  for (const issue of issues) {
    console.log(
      `${issue.file} ${issue.field} length ${issue.length} (${issue.expected}): ${issue.value}`,
    );
  }
}

const issues = [
  ...(await auditMarkdownRoutes(DOCS_ROUTES_DIR)),
  ...(await auditMarkdownRoutes(BLOG_ROUTES_DIR)),
];

printIssues(issues);

if (process.argv.includes("--strict") && issues.length > 0) {
  process.exit(1);
}
