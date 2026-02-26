import path from "node:path";
import ts from "typescript";

interface ApiSymbolDoc {
  name: string;
  kind: string;
  signature: string;
  sourcePath: string;
  description?: string;
  links?: Array<{
    label: string;
    href: string;
  }>;
}

interface ApiDocFile {
  title: string;
  description: string;
  section: string;
  order: number;
  symbols: ApiSymbolDoc[];
  intro?: string;
  examples?: Array<{
    title: string;
    code: string;
  }>;
}

interface ApiEntrypoint {
  slug: string;
  source: string;
  title: string;
  description: string;
  section: string;
  order: number;
  intro?: string;
  examples?: Array<{
    title: string;
    code: string;
  }>;
}

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "app/routes/docs/api");

const SYMBOL_DETAILS: Record<
  string,
  {
    description: string;
    links?: Array<{ label: string; href: string }>;
  }
> = {
  Action: {
    description: "Route action function signature for handling mutating HTTP requests.",
    links: [{ label: "Actions and mutation flow", href: "/docs/core-concepts/actions" }],
  },
  ActionContext: {
    description: "Context object passed to actions with request metadata and parsed body helpers.",
    links: [{ label: "Actions and mutation flow", href: "/docs/core-concepts/actions" }],
  },
  ActionResult: {
    description: "Allowed return union for actions, including data, redirects, and `Response` values.",
    links: [{ label: "Actions and mutation flow", href: "/docs/core-concepts/actions" }],
  },
  ApiRouteModule: {
    description: "Contract for API route modules exporting method handlers like `GET` and `POST`.",
    links: [{ label: "Routing model", href: "/docs/core-concepts/routing-model" }],
  },
  BuildManifest: {
    description: "Production manifest describing built route assets used for SSR document injection.",
    links: [{ label: "Build artifacts", href: "/docs/tooling/build-artifacts" }],
  },
  BuildRouteAsset: {
    description: "Per-route client asset metadata (entry script and CSS files).",
    links: [{ label: "Build artifacts", href: "/docs/tooling/build-artifacts" }],
  },
  createServer: {
    description: "Creates the runtime request handler used by Bun server entrypoints.",
    links: [
      { label: "Bun-only deployment", href: "/docs/deployment/bun-deployment" },
      { label: "SSR and hydration", href: "/docs/rendering/ssr-hydration" },
    ],
  },
  defer: {
    description: "Marks loader return data as deferred so promise-backed keys can stream progressively.",
    links: [
      { label: "Loaders and data flow", href: "/docs/core-concepts/loaders" },
      { label: "SSR and hydration", href: "/docs/rendering/ssr-hydration" },
    ],
  },
  DeferredLoaderResult: {
    description: "Typed wrapper returned by `defer()` for loaders with immediate and deferred values.",
    links: [{ label: "Loaders and data flow", href: "/docs/core-concepts/loaders" }],
  },
  DeferredToken: {
    description: "Serialized payload token used internally to revive deferred values during hydration.",
    links: [{ label: "SSR and hydration", href: "/docs/rendering/ssr-hydration" }],
  },
  defineConfig: {
    description: "Helper for authoring typed `rbssr.config.ts` configuration.",
    links: [{ label: "Environment configuration", href: "/docs/deployment/environment" }],
  },
  FrameworkConfig: {
    description: "Main framework configuration surface for paths, server mode, and response headers.",
    links: [{ label: "Environment configuration", href: "/docs/deployment/environment" }],
  },
  json: {
    description: "Creates a JSON `Response` with a default UTF-8 content-type.",
    links: [{ label: "API reference overview", href: "/docs/api-reference/overview" }],
  },
  Loader: {
    description: "Route loader function signature for GET/HEAD data requests.",
    links: [{ label: "Loaders and data flow", href: "/docs/core-concepts/loaders" }],
  },
  LoaderContext: {
    description: "Context object passed to loaders with URL, params, cookies, and mutable locals.",
    links: [{ label: "Loaders and data flow", href: "/docs/core-concepts/loaders" }],
  },
  LoaderResult: {
    description: "Allowed return union for loaders, including plain data, redirects, deferred data, and `Response`.",
    links: [{ label: "Loaders and data flow", href: "/docs/core-concepts/loaders" }],
  },
  Middleware: {
    description: "Middleware function contract executed around page and API handlers.",
    links: [{ label: "Middleware chain", href: "/docs/core-concepts/middleware" }],
  },
  Outlet: {
    description: "Renders the next nested route element inside root/layout route modules.",
    links: [{ label: "Nested layouts and route groups", href: "/docs/core-concepts/layouts-and-groups" }],
  },
  Params: {
    description: "Dynamic URL params object shape exposed to loaders, actions, and hooks.",
    links: [{ label: "Routing model", href: "/docs/core-concepts/routing-model" }],
  },
  redirect: {
    description: "Returns a framework redirect descriptor consumed by loader/action runtime flow.",
    links: [{ label: "Actions and mutation flow", href: "/docs/core-concepts/actions" }],
  },
  RedirectResult: {
    description: "Redirect descriptor shape with destination and HTTP redirect status.",
    links: [{ label: "Actions and mutation flow", href: "/docs/core-concepts/actions" }],
  },
  RequestContext: {
    description: "Base request context shared by middleware, loaders, actions, and API handlers.",
    links: [{ label: "Middleware chain", href: "/docs/core-concepts/middleware" }],
  },
  ResponseHeaderRule: {
    description: "Path-based response header rule used by `FrameworkConfig.headers`.",
    links: [{ label: "Environment configuration", href: "/docs/deployment/environment" }],
  },
  RouteModule: {
    description: "Page route module contract including component and optional route lifecycle exports.",
    links: [{ label: "Routing model", href: "/docs/core-concepts/routing-model" }],
  },
  Router: {
    description: "Programmatic navigation contract returned by `useRouter`.",
    links: [{ label: "Routing model", href: "/docs/core-concepts/routing-model" }],
  },
  RouterNavigateOptions: {
    description: "Options accepted by `router.push()` and `router.replace()`.",
    links: [{ label: "Routing model", href: "/docs/core-concepts/routing-model" }],
  },
  startHttpServer: {
    description: "Starts Bun HTTP server for configured framework runtime.",
    links: [{ label: "Bun-only deployment", href: "/docs/deployment/bun-deployment" }],
  },
  useLoaderData: {
    description: "Reads loader data in route components, including deferred values as promises.",
    links: [{ label: "Loaders and data flow", href: "/docs/core-concepts/loaders" }],
  },
  useParams: {
    description: "Returns dynamic route params for the current matched route.",
    links: [{ label: "Routing model", href: "/docs/core-concepts/routing-model" }],
  },
  useRouter: {
    description: "Returns a Next.js-style router object for programmatic client transitions.",
    links: [{ label: "Routing model", href: "/docs/core-concepts/routing-model" }],
  },
  useRequestUrl: {
    description: "Returns the current request URL object in route components.",
    links: [{ label: "Loaders and data flow", href: "/docs/core-concepts/loaders" }],
  },
  useRouteError: {
    description: "Reads error values inside `ErrorBoundary` route components.",
    links: [{ label: "Error boundaries and not-found", href: "/docs/rendering/error-and-not-found" }],
  },
};

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
    return declaration.getText();
  }

  if (symbol.flags & ts.SymbolFlags.TypeAlias) {
    return declaration.getText();
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
      description: SYMBOL_DETAILS[symbol.getName()]?.description,
      links: SYMBOL_DETAILS[symbol.getName()]?.links,
    };
  });

  return docs.sort((a, b) => a.name.localeCompare(b.name));
}

function docMarkdown(file: ApiDocFile): string {
  const introBlock = file.intro ? `${file.intro}\n\n` : "";
  const examplesBlock =
    file.examples && file.examples.length > 0
      ? `## Examples\n\n${file.examples
          .map(example => `### ${example.title}\n\n\`\`\`tsx\n${example.code}\n\`\`\``)
          .join("\n\n")}\n\n`
      : "";

  const blocks = file.symbols
    .map(symbol => {
      const descriptionLine = symbol.description
        ? `- Description: ${symbol.description}\n`
        : "";
      const linksLine = symbol.links && symbol.links.length > 0
        ? `- Learn more: ${symbol.links.map(link => `[${link.label}](${link.href})`).join(", ")}\n`
        : "";
      return `## ${symbol.name}\n\n- Kind: ${symbol.kind}\n- Source: \`${symbol.sourcePath}\`\n${descriptionLine}${linksLine}\n\`\`\`ts\n${symbol.signature}\n\`\`\``;
    })
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

${introBlock}${examplesBlock}## Exported symbols

${blocks}
`;
}

function buildApiDocs(): Record<string, string> {
  const entrypoints: ApiEntrypoint[] = [
    {
      slug: "react-bun-ssr",
      source: path.join(ROOT, "framework/runtime/index.ts"),
      title: "react-bun-ssr",
      description: "Public runtime exports from the root package entrypoint.",
      section: "API Reference",
      order: 2,
      intro:
        "Import from `react-bun-ssr` for framework runtime APIs (`createServer`, `startHttpServer`), config helpers, and shared route contracts.",
      examples: [
        {
          title: "Typed config with response headers",
          code: `import { defineConfig } from "react-bun-ssr";

export default defineConfig({
  port: 3000,
  headers: [
    {
      source: "/api/**",
      headers: {
        "x-frame-options": "DENY",
      },
    },
  ],
});`,
        },
        {
          title: "Runtime JSON and redirect helpers",
          code: `import { json, redirect } from "react-bun-ssr";

export function GET() {
  return json({ ok: true });
}

export function POST() {
  return redirect("/docs/core-concepts/actions");
}`,
        },
      ],
    },
    {
      slug: "react-bun-ssr-route",
      source: path.join(ROOT, "framework/runtime/route-api.ts"),
      title: "react-bun-ssr/route",
      description: "Route module contracts, hooks, and helpers exposed to application routes.",
      section: "API Reference",
      order: 3,
      intro:
        "Use this entrypoint inside route modules for hooks (`useLoaderData`, `useParams`, `Outlet`) and route contract types (`Loader`, `Action`, `Middleware`).",
      examples: [
        {
          title: "Loader + `useLoaderData`",
          code: `import { useLoaderData, type Loader } from "react-bun-ssr/route";

export const loader: Loader = ({ params }) => {
  return { postId: params.id ?? "unknown" };
};

export default function PostPage() {
  const data = useLoaderData<{ postId: string }>();
  return <h1>Post {data.postId}</h1>;
}`,
        },
        {
          title: "Action + redirect helper",
          code: `import { redirect } from "react-bun-ssr";
import type { Action } from "react-bun-ssr/route";

export const action: Action = async ({ formData }) => {
  const name = String(formData?.get("name") ?? "").trim();
  if (!name) return { error: "name is required" };
  return redirect("/docs/core-concepts/actions");
};`,
        },
        {
          title: "Route middleware",
          code: `import type { Middleware } from "react-bun-ssr/route";

export const middleware: Middleware = async (ctx, next) => {
  if (!ctx.cookies.get("session")) {
    return new Response("Unauthorized", { status: 401 });
  }
  return next();
};`,
        },
        {
          title: "Deferred loader data",
          code: `import { Suspense, use } from "react";
import { defer, useLoaderData, type Loader } from "react-bun-ssr/route";

export const loader: Loader = () => {
  return defer({
    title: "Dashboard",
    stats: Promise.resolve({ users: 42 }),
  });
};

function Stats(props: { stats: Promise<{ users: number }> }) {
  const value = use(props.stats);
  return <p>Users: {value.users}</p>;
}

export default function DashboardPage() {
  const data = useLoaderData<{ title: string; stats: Promise<{ users: number }> }>();
  return (
    <>
      <h1>{data.title}</h1>
      <Suspense fallback={<p>Loading stats…</p>}>
        <Stats stats={data.stats} />
      </Suspense>
    </>
  );
}`,
        },
      ],
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
      intro: entry.intro,
      examples: entry.examples,
    });
  }

  return output;
}

export async function generateApiDocs(): Promise<void> {
  const docs = buildApiDocs();

  for (const [slug, markdown] of Object.entries(docs)) {
    await Bun.write(path.join(OUT_DIR, `${slug}.md`), markdown);
  }
}

if (import.meta.main) {
  generateApiDocs().catch(error => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
}
