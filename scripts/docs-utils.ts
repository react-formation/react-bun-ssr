import path from "node:path";
import {
  addHeadingIds,
  extractHeadingEntriesFromHtml as extractHtmlHeadingEntries,
  type MarkdownHeadingEntry,
} from "../framework/runtime/markdown-headings";

export interface ParsedFrontmatter {
  [key: string]: string;
}

export interface ParsedMarkdownFile {
  frontmatter: ParsedFrontmatter;
  body: string;
}

export type HeadingEntry = MarkdownHeadingEntry;

async function directoryExists(dirPath: string): Promise<boolean> {
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

export async function walkFiles(rootDir: string, ext: string): Promise<string[]> {
  if (!(await directoryExists(rootDir))) {
    return [];
  }

  const normalizedExt = ext.startsWith(".") ? ext : `.${ext}`;
  const scanner = new Bun.Glob(`**/*${normalizedExt}`);
  const result: string[] = [];

  for await (const filePath of scanner.scan({ cwd: rootDir, absolute: true, dot: true })) {
    result.push(path.resolve(filePath));
  }

  return result.sort((a, b) => a.localeCompare(b));
}

export function parseMarkdownWithFrontmatter(raw: string): ParsedMarkdownFile {
  if (!raw.startsWith("---\n")) {
    throw new Error("Missing frontmatter block");
  }

  const end = raw.indexOf("\n---\n", 4);
  if (end < 0) {
    throw new Error("Unterminated frontmatter block");
  }

  const frontmatterLines = raw.slice(4, end).split("\n");
  const frontmatter: ParsedFrontmatter = {};

  for (const line of frontmatterLines) {
    const separator = line.indexOf(":");
    if (separator < 0) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    frontmatter[key] = value;
  }

  return {
    frontmatter,
    body: raw.slice(end + 5),
  };
}

export function parseTags(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map(tag => tag.trim())
    .filter(Boolean);
}

export function markdownToText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/\[[^\]]+\]\(([^)]+)\)/g, " ")
    .replace(/#+\s+/g, "")
    .replace(/[*_>~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractHeadings(markdown: string): string[] {
  return markdown
    .split(/\r?\n/)
    .map(line => /^(#{1,6})\s+(.+)$/.exec(line))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map(match => match[2]!.trim());
}

function stripLeadingH1(html: string): string {
  return html.replace(/^\s*<h1\b[^>]*>[\s\S]*?<\/h1>\s*/i, "");
}

export function renderMarkdownHtml(parsed: ParsedMarkdownFile): string {
  const html = addHeadingIds(Bun.markdown.html(parsed.body));
  return parsed.frontmatter.title ? stripLeadingH1(html) : html;
}

export function extractHeadingEntriesFromHtml(html: string): HeadingEntry[] {
  return extractHtmlHeadingEntries(html);
}

export function tokenize(value: string): string[] {
  const seen = new Set<string>();
  for (const token of value.toLowerCase().split(/[^a-z0-9]+/g)) {
    if (token.length >= 2) {
      seen.add(token);
    }
  }
  return Array.from(seen);
}

export function toPosixPath(value: string): string {
  return value.replace(/\\/g, "/");
}
