import fs from "node:fs";
import path from "node:path";
import { sidebar, type SidebarSection } from "../../docs/meta/sidebar";

interface Frontmatter {
  title: string;
  description: string;
  section: string;
  order: number;
  tags: string[];
}

export interface DocHeading {
  level: number;
  id: string;
  text: string;
}

export interface DocPage {
  slug: string;
  title: string;
  description: string;
  section: string;
  tags: string[];
  order: number;
  html: string;
  headings: DocHeading[];
  toc: DocHeading[];
}

export interface DocNavLink {
  title: string;
  slug: string;
}

export interface DocNeighbors {
  prev: DocNavLink | null;
  next: DocNavLink | null;
}

const ROOT_DIR =
  typeof process !== "undefined" && typeof process.cwd === "function" ? process.cwd() : "";
const CONTENT_DIR = path.join(ROOT_DIR, "docs/content");
const GENERATED_DIR = path.join(ROOT_DIR, "docs/generated");
const REQUIRED_FRONTMATTER = ["title", "description", "section", "order"] as const;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function toSourcePath(slug: string): string {
  return path.join(CONTENT_DIR, `${slug}.md`);
}

function toGeneratedPath(slug: string): string {
  return path.join(GENERATED_DIR, `${slug}.md`);
}

function parseFrontmatter(source: string): { frontmatter: Frontmatter; markdown: string } {
  if (!source.startsWith("---\n")) {
    throw new Error("Missing frontmatter block");
  }

  const end = source.indexOf("\n---\n", 4);
  if (end < 0) {
    throw new Error("Unterminated frontmatter block");
  }

  const raw = source.slice(4, end).split("\n");
  const markdown = source.slice(end + 5);

  const values = new Map<string, string>();
  for (const line of raw) {
    const separator = line.indexOf(":");
    if (separator < 0) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    values.set(key, value);
  }

  for (const key of REQUIRED_FRONTMATTER) {
    if (!values.has(key)) {
      throw new Error(`Missing required frontmatter field: ${key}`);
    }
  }

  const tags = (values.get("tags") ?? "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);

  return {
    frontmatter: {
      title: values.get("title") ?? "",
      description: values.get("description") ?? "",
      section: values.get("section") ?? "",
      order: Number(values.get("order") ?? 0),
      tags,
    },
    markdown,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inlineMarkdown(line: string): string {
  return line
    .replace(/`([^`]+)`/g, (_m, code) => `<code>${escapeHtml(code)}</code>`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text, href) => `<a href="${escapeHtml(href)}">${escapeHtml(text)}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, (_m, text) => `<strong>${escapeHtml(text)}</strong>`)
    .replace(/\*([^*]+)\*/g, (_m, text) => `<em>${escapeHtml(text)}</em>`);
}

function highlightWithRegex(
  source: string,
  regex: RegExp,
  classify: (value: string) => string,
): string {
  let cursor = 0;
  let html = "";
  let match = regex.exec(source);

  while (match) {
    const value = match[0] ?? "";
    const index = match.index;

    if (index > cursor) {
      html += escapeHtml(source.slice(cursor, index));
    }

    html += `<span class="token ${classify(value)}">${escapeHtml(value)}</span>`;
    cursor = index + value.length;
    match = regex.exec(source);
  }

  if (cursor < source.length) {
    html += escapeHtml(source.slice(cursor));
  }

  return html;
}

function highlightCode(source: string, language: string): string {
  const normalized = language.toLowerCase();

  if (["ts", "tsx", "js", "jsx", "mjs", "cjs"].includes(normalized)) {
    const pattern =
      /(\/\/.*$|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:const|let|var|function|return|if|else|for|while|switch|case|break|continue|import|from|export|default|async|await|try|catch|throw|new|class|extends|interface|type|implements|public|private|protected|readonly|as|in|of|typeof)\b|\b(?:true|false|null|undefined)\b|\b\d+(?:\.\d+)?\b)/gm;

    return highlightWithRegex(source, pattern, value => {
      if (value.startsWith("//") || value.startsWith("/*")) return "comment";
      if (
        value.startsWith("\"") ||
        value.startsWith("'") ||
        value.startsWith("`")
      )
        return "string";
      if (/^\d/.test(value)) return "number";
      if (/^(true|false|null|undefined)$/.test(value)) return "constant";
      return "keyword";
    });
  }

  if (["bash", "sh", "zsh", "shell"].includes(normalized)) {
    const pattern =
      /(#.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:if|then|fi|for|in|do|done|case|esac|while|function|export)\b|(?:^|\s)(?:bun|npm|node|git|curl|cd|ls|cat|echo)(?=\s|$)|--?[a-zA-Z0-9-]+)/gm;

    return highlightWithRegex(source, pattern, value => {
      const trimmed = value.trim();
      if (trimmed.startsWith("#")) return "comment";
      if (trimmed.startsWith("\"") || trimmed.startsWith("'")) return "string";
      if (trimmed.startsWith("-")) return "operator";
      if (/^(if|then|fi|for|in|do|done|case|esac|while|function|export)$/.test(trimmed))
        return "keyword";
      return "builtin";
    });
  }

  return escapeHtml(source);
}

function parseMarkdown(markdown: string): { html: string; headings: DocHeading[] } {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  const headings: DocHeading[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let codeFence = false;
  let codeLang = "";
  let codeLines: string[] = [];

  const flushParagraph = (): void => {
    if (paragraph.length === 0) {
      return;
    }
    html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const flushList = (): void => {
    if (list.length === 0) {
      return;
    }
    html.push(`<ul>${list.join("")}</ul>`);
    list = [];
  };

  const flushCode = (): void => {
    const highlighted = highlightCode(codeLines.join("\n"), codeLang || "text");
    html.push(
      `<pre><code class="language-${escapeHtml(codeLang || "text")}">${highlighted}</code></pre>`,
    );
    codeLines = [];
    codeLang = "";
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (!codeFence) {
        flushParagraph();
        flushList();
        codeFence = true;
        codeLang = line.slice(3).trim();
      } else {
        codeFence = false;
        flushCode();
      }
      continue;
    }

    if (codeFence) {
      codeLines.push(line);
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      // The page title is rendered by the docs shell, so markdown content starts at h2.
      const rawLevel = heading[1]!.length;
      const level = rawLevel === 1 ? 2 : rawLevel;
      const text = heading[2]!.trim();
      const id = slugify(text);
      headings.push({ level, text, id });
      html.push(`<h${level} id="${id}">${inlineMarkdown(text)}</h${level}>`);
      continue;
    }

    if (/^\s*-\s+/.test(line)) {
      flushParagraph();
      const itemText = line.replace(/^\s*-\s+/, "").trim();
      list.push(`<li>${inlineMarkdown(itemText)}</li>`);
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      flushList();
      continue;
    }

    paragraph.push(line.trim());
  }

  if (codeFence) {
    flushCode();
  }
  flushParagraph();
  flushList();

  return { html: html.join("\n"), headings };
}

function readDocSource(slug: string): { source: string; generated: boolean } {
  const sourcePath = toSourcePath(slug);
  if (fs.existsSync(sourcePath)) {
    return { source: fs.readFileSync(sourcePath, "utf8"), generated: false };
  }

  const generatedPath = toGeneratedPath(slug);
  if (fs.existsSync(generatedPath)) {
    return { source: fs.readFileSync(generatedPath, "utf8"), generated: true };
  }

  throw new Error(`Missing doc content for slug: ${slug}`);
}

export function getDocsSidebar(): SidebarSection[] {
  return sidebar;
}

export function getDefaultDocSlug(): string {
  return sidebar[0]?.items[0]?.slug ?? "";
}

export function getAllDocSlugs(): string[] {
  return sidebar.flatMap(section => section.items.map(item => item.slug));
}

export function resolveDocNeighbors(slug: string): DocNeighbors {
  const flat = sidebar.flatMap(section => section.items);
  const index = flat.findIndex(item => item.slug === slug);
  if (index < 0) {
    return { prev: null, next: null };
  }

  const prevItem = index > 0 ? flat[index - 1] : null;
  const nextItem = index < flat.length - 1 ? flat[index + 1] : null;

  return {
    prev: prevItem ? { title: prevItem.title, slug: prevItem.slug } : null,
    next: nextItem ? { title: nextItem.title, slug: nextItem.slug } : null,
  };
}

export function loadDocPage(slug: string): DocPage {
  const { source } = readDocSource(slug);
  const { frontmatter, markdown } = parseFrontmatter(source);
  const parsed = parseMarkdown(markdown);

  return {
    slug,
    title: frontmatter.title,
    description: frontmatter.description,
    section: frontmatter.section,
    tags: frontmatter.tags,
    order: frontmatter.order,
    html: parsed.html,
    headings: parsed.headings,
    toc: parsed.headings.filter(item => item.level <= 3),
  };
}

export function loadSearchIndex(): Array<{
  id: string;
  title: string;
  section: string;
  headings: string[];
  excerpt: string;
  url: string;
  tokens: string[];
}> {
  const searchFile = path.join(GENERATED_DIR, "search-index.json");
  if (!fs.existsSync(searchFile)) {
    return [];
  }

  const raw = fs.readFileSync(searchFile, "utf8");
  return JSON.parse(raw) as Array<{
    id: string;
    title: string;
    section: string;
    headings: string[];
    excerpt: string;
    url: string;
    tokens: string[];
  }>;
}
