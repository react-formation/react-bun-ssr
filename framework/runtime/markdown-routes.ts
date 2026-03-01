import path from "node:path";
import { addHeadingIds } from "./markdown-headings";
import { existsPath, readText, writeTextIfChanged } from "./io";
import { normalizeSlashes, stableHash, trimFileExtension } from "./utils";

const compiledMarkdownCache = new Map<string, { sourceHash: string; outputPath: string }>();
const MARKDOWN_WRAPPER_VERSION = "3";

interface ParsedFrontmatter {
  title?: string;
  description?: string;
  section?: string;
  tags: string[];
}

function decodeHtml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
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
      html += Bun.escapeHTML(source.slice(cursor, index));
    }

    html += `<span class="token ${classify(value)}">${Bun.escapeHTML(value)}</span>`;
    cursor = index + value.length;
    match = regex.exec(source);
  }

  if (cursor < source.length) {
    html += Bun.escapeHTML(source.slice(cursor));
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

  return Bun.escapeHTML(source);
}

function applySyntaxHighlight(html: string): string {
  return html.replace(
    /<pre><code class="language-([^"]+)">([\s\S]*?)<\/code><\/pre>/g,
    (_match, language: string, rawCode: string) => {
      const code = decodeHtml(rawCode);
      const highlighted = highlightCode(code, language);
      return `<pre><code class="language-${Bun.escapeHTML(language)}">${highlighted}</code></pre>`;
    },
  );
}

function resolveGeneratedRoot(routesDir: string, generatedMarkdownRootDir?: string): string {
  if (generatedMarkdownRootDir) {
    return path.resolve(generatedMarkdownRootDir);
  }

  const normalizedRoutesDir = normalizeSlashes(path.resolve(routesDir));
  const appRoutesMatch = normalizedRoutesDir.match(/^(.*)\/app\/routes$/);
  if (appRoutesMatch) {
    return path.resolve(appRoutesMatch[1]!, ".rbssr", "generated", "markdown-routes");
  }

  const snapshotRoutesMatch = normalizedRoutesDir.match(
    /^(.*)\/\.rbssr\/dev\/server-snapshots\/v\d+\/routes$/,
  );
  if (snapshotRoutesMatch) {
    return path.resolve(snapshotRoutesMatch[1]!, ".rbssr", "generated", "markdown-routes");
  }

  return path.resolve(routesDir, "..", ".rbssr", "generated", "markdown-routes");
}

function toRouteGroupKey(routesDir: string): string {
  const normalized = normalizeSlashes(path.resolve(routesDir));
  const canonical = normalized.replace(
    /\/\.rbssr\/dev\/server-snapshots\/v\d+\/routes$/,
    "/.rbssr/dev/server-snapshots/routes",
  );

  return stableHash(`${MARKDOWN_WRAPPER_VERSION}\0${canonical}`);
}

function parseFrontmatter(raw: string): {
  frontmatter: ParsedFrontmatter;
  markdown: string;
} {
  if (!raw.startsWith("---\n")) {
    return {
      frontmatter: { tags: [] },
      markdown: raw,
    };
  }

  const end = raw.indexOf("\n---\n", 4);
  if (end < 0) {
    return {
      frontmatter: { tags: [] },
      markdown: raw,
    };
  }

  const rawFrontmatterLines = raw.slice(4, end).split("\n");
  const values = new Map<string, string>();
  for (const line of rawFrontmatterLines) {
    const separator = line.indexOf(":");
    if (separator < 0) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    values.set(key, value);
  }

  const tags = (values.get("tags") ?? "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);

  return {
    frontmatter: {
      title: values.get("title"),
      description: values.get("description"),
      section: values.get("section"),
      tags,
    },
    markdown: raw.slice(end + 5),
  };
}

function stripLeadingH1(html: string): string {
  return html.replace(/^\s*<h1\b[^>]*>[\s\S]*?<\/h1>\s*/i, "");
}

function toWrapperSource(options: {
  html: string;
  frontmatter: ParsedFrontmatter;
}): string {
  const { html, frontmatter } = options;
  const title = frontmatter.title ?? "";
  const description = frontmatter.description ?? "";
  const section = frontmatter.section ?? "";
  const tags = frontmatter.tags ?? [];

  return `const markdownHtml = ${JSON.stringify(html)};
const markdownTitle = ${JSON.stringify(title)};
const markdownDescription = ${JSON.stringify(description)};
const markdownSection = ${JSON.stringify(section)};
const markdownTags = ${JSON.stringify(tags)};

export default function MarkdownRoute() {
  return (
    <>
      {markdownTitle ? (
        <header className="docs-hero">
          {markdownSection ? <p className="kicker">{markdownSection}</p> : null}
          <h1>{markdownTitle}</h1>
          {markdownDescription ? <p>{markdownDescription}</p> : null}
          {markdownTags.length > 0 ? (
            <div>
              {markdownTags.map(tag => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          ) : null}
        </header>
      ) : null}
      <section className="docs-content-body" dangerouslySetInnerHTML={{ __html: markdownHtml }} />
    </>
  );
}

export function head() {
  if (!markdownTitle) {
    return null;
  }
  return <title>{markdownTitle}</title>;
}

export function meta() {
  const values: Record<string, string> = {};

  if (markdownDescription) {
    values.description = markdownDescription;
    values["og:description"] = markdownDescription;
    values["twitter:description"] = markdownDescription;
  }

  if (markdownTitle) {
    values["og:title"] = markdownTitle;
    values["twitter:title"] = markdownTitle;
  }

  values["og:type"] = "article";
  values["twitter:card"] = "summary_large_image";

  if (markdownSection) {
    values["article:section"] = markdownSection;
  }

  if (markdownTags.length > 0) {
    const joinedTags = markdownTags.join(", ");
    values.keywords = joinedTags;
    values["article:tag"] = joinedTags;
  }

  return values;
}
`;
}

async function writeFileIfChanged(filePath: string, content: string): Promise<void> {
  await writeTextIfChanged(filePath, content);
}

export async function compileMarkdownRouteModule(options: {
  routesDir: string;
  sourceFilePath: string;
  generatedMarkdownRootDir?: string;
}): Promise<string> {
  const routesDir = path.resolve(options.routesDir);
  const sourceFilePath = path.resolve(options.sourceFilePath);
  const generatedRoot = resolveGeneratedRoot(routesDir, options.generatedMarkdownRootDir);
  const routeGroupKey = toRouteGroupKey(routesDir);
  const relativeRoutePath = normalizeSlashes(path.relative(routesDir, sourceFilePath));
  const routeModuleRelativePath = `${trimFileExtension(relativeRoutePath)}.tsx`;
  const outputPath = path.join(generatedRoot, routeGroupKey, routeModuleRelativePath);

  const markdownSource = await readText(sourceFilePath);
  const sourceHash = stableHash(`${MARKDOWN_WRAPPER_VERSION}\0${markdownSource}`);
  const cacheKey = `${sourceFilePath}::${outputPath}`;
  const cached = compiledMarkdownCache.get(cacheKey);
  if (cached && cached.sourceHash === sourceHash && await existsPath(cached.outputPath)) {
    return cached.outputPath;
  }

  const parsed = parseFrontmatter(markdownSource);
  const highlightedHtml = applySyntaxHighlight(addHeadingIds(Bun.markdown.html(parsed.markdown)));
  const html = parsed.frontmatter.title ? stripLeadingH1(highlightedHtml) : highlightedHtml;
  await writeFileIfChanged(
    outputPath,
    toWrapperSource({
      html,
      frontmatter: parsed.frontmatter,
    }),
  );
  compiledMarkdownCache.set(cacheKey, { sourceHash, outputPath });

  return outputPath;
}
