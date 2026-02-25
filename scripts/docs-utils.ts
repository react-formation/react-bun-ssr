import fs from "node:fs";
import path from "node:path";

export interface ParsedFrontmatter {
  [key: string]: string;
}

export interface ParsedMarkdownFile {
  frontmatter: ParsedFrontmatter;
  body: string;
}

export function walkFiles(rootDir: string, ext: string): string[] {
  if (!fs.existsSync(rootDir)) {
    return [];
  }

  const result: string[] = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const dir = stack.pop()!;
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && fullPath.endsWith(ext)) {
        result.push(fullPath);
      }
    }
  }

  return result.sort();
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
