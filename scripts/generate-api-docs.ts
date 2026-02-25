import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

interface ApiSymbolDoc {
  name: string;
  kind: string;
  signature: string;
  sourcePath: string;
}

interface ApiDocFile {
  title: string;
  description: string;
  section: string;
  order: number;
  symbols: ApiSymbolDoc[];
}

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "docs/generated/api");

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function normalizeSignature(signature: string): string {
  return signature.replace(/\s+/g, " ").trim();
}

function symbolKind(symbol: ts.Symbol): string {
  if (symbol.flags & ts.SymbolFlags.Function) return "function";
  if (symbol.flags & ts.SymbolFlags.Interface) return "interface";
  if (symbol.flags & ts.SymbolFlags.TypeAlias) return "type";
  if (symbol.flags & ts.SymbolFlags.Class) return "class";
  if (symbol.flags & ts.SymbolFlags.Variable) return "variable";
  if (symbol.flags & ts.SymbolFlags.Module) return "module";
  return "symbol";
}

function declarationSourceFile(symbol: ts.Symbol): ts.SourceFile | null {
  const declaration = symbol.declarations?.[0];
  return declaration ? declaration.getSourceFile() : null;
}

function symbolSignature(checker: ts.TypeChecker, symbol: ts.Symbol): string {
  const declaration = symbol.declarations?.[0];
  if (!declaration) {
    return "unknown";
  }

  const type = checker.getTypeOfSymbolAtLocation(symbol, declaration);
  const callSignatures = checker.getSignaturesOfType(type, ts.SignatureKind.Call);
  if (callSignatures.length > 0) {
    return normalizeSignature(`${symbol.getName()}${checker.signatureToString(callSignatures[0]!)}`);
  }

  if (symbol.flags & ts.SymbolFlags.Interface) {
    const line = declaration.getText().split(/\r?\n/)[0] ?? "";
    return normalizeSignature(line);
  }

  if (symbol.flags & ts.SymbolFlags.TypeAlias) {
    const line = declaration.getText().split(/\r?\n/)[0] ?? "";
    return normalizeSignature(line);
  }

  return normalizeSignature(`${symbol.getName()}: ${checker.typeToString(type)}`);
}

function collectModuleExportDocs(
  checker: ts.TypeChecker,
  sourceFile: ts.SourceFile,
): ApiSymbolDoc[] {
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) {
    return [];
  }

  const exports = checker
    .getExportsOfModule(moduleSymbol)
    .map(symbol => (symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol));

  const docs: ApiSymbolDoc[] = exports.map(symbol => {
    const sourceFileRef = declarationSourceFile(symbol);
    const sourcePath = sourceFileRef
      ? path.relative(ROOT, sourceFileRef.fileName).replace(/\\/g, "/")
      : path.relative(ROOT, sourceFile.fileName).replace(/\\/g, "/");

    return {
      name: symbol.getName(),
      kind: symbolKind(symbol),
      signature: symbolSignature(checker, symbol),
      sourcePath,
    };
  });

  return docs.sort((a, b) => a.name.localeCompare(b.name));
}

function docMarkdown(file: ApiDocFile): string {
  const blocks = file.symbols
    .map(
      symbol => `## ${symbol.name}\n\n- Kind: ${symbol.kind}\n- Source: \`${symbol.sourcePath}\`\n\n\`\`\`ts\n${symbol.signature}\n\`\`\``,
    )
    .join("\n\n");

  return `---
title: ${file.title}
description: ${file.description}
section: ${file.section}
order: ${file.order}
tags: api,generated
---

# ${file.title}

Auto-generated from framework TypeScript exports. Do not edit manually.

${blocks}
`;
}

function buildApiDocs(): Record<string, string> {
  const entrypoints = [
    {
      slug: "react-bun-ssr",
      source: path.join(ROOT, "framework/runtime/index.ts"),
      title: "react-bun-ssr",
      description: "Public runtime exports from the root package entrypoint.",
      section: "API Reference",
      order: 2,
    },
    {
      slug: "react-bun-ssr-route",
      source: path.join(ROOT, "framework/runtime/route-api.ts"),
      title: "react-bun-ssr/route",
      description: "Route module contracts, hooks, and helpers exposed to application routes.",
      section: "API Reference",
      order: 3,
    },
  ];

  const program = ts.createProgram({
    rootNames: entrypoints.map(entry => entry.source),
    options: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      strict: true,
      skipLibCheck: true,
    },
  });

  const checker = program.getTypeChecker();

  const output: Record<string, string> = {};

  for (const entry of entrypoints) {
    const sourceFile = program.getSourceFile(entry.source);
    if (!sourceFile) {
      throw new Error(`Unable to load source file: ${entry.source}`);
    }

    const symbols = collectModuleExportDocs(checker, sourceFile);
    output[entry.slug] = docMarkdown({
      title: entry.title,
      description: entry.description,
      section: entry.section,
      order: entry.order,
      symbols,
    });
  }

  return output;
}

export function generateApiDocs(): void {
  ensureDir(OUT_DIR);
  const docs = buildApiDocs();

  for (const [slug, markdown] of Object.entries(docs)) {
    fs.writeFileSync(path.join(OUT_DIR, `${slug}.md`), markdown, "utf8");
  }
}

if (import.meta.main) {
  generateApiDocs();
}
