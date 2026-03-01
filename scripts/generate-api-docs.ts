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
    links: [{ label: "Actions", href: "/docs/data/actions" }],
  },
  ActionContext: {
    description:
      "Context object passed to actions with request metadata, parsed body helpers, and framework-normalized cookies exposed as `Map<string, string>` rather than Bun's `CookieMap`.",
    links: [
      { label: "Actions", href: "/docs/data/actions" },
      { label: "Bun Runtime APIs", href: "/docs/api/bun-runtime-apis" },
      { label: "Cookies", href: "https://bun.com/docs/api/cookie" },
      { label: "HTTP server cookies", href: "https://bun.com/docs/runtime/http/cookies" },
    ],
  },
  ActionResult: {
    description: "Allowed return union for actions, including data, redirects, and `Response` values.",
    links: [{ label: "Actions", href: "/docs/data/actions" }],
  },
  ApiRouteModule: {
    description: "Contract for API route modules exporting method handlers like `GET` and `POST`.",
    links: [{ label: "File-Based Routing", href: "/docs/routing/file-based-routing" }],
  },
  BuildManifest: {
    description: "Production manifest describing built route assets used for SSR document injection.",
    links: [{ label: "Build Output", href: "/docs/tooling/build-output" }],
  },
  BuildRouteAsset: {
    description: "Per-route client asset metadata (entry script and CSS files).",
    links: [{ label: "Build Output", href: "/docs/tooling/build-output" }],
  },
  createServer: {
    description: "Creates the runtime request handler used by Bun server entrypoints.",
    links: [
      { label: "Bun Runtime APIs", href: "/docs/api/bun-runtime-apis" },
      { label: "Bun-only deployment", href: "/docs/deployment/bun-deployment" },
      { label: "SSR and hydration", href: "/docs/rendering/ssr-hydration" },
      { label: "Bun APIs", href: "https://bun.com/docs/runtime/bun-apis" },
      { label: "Common HTTP server usage", href: "https://bun.com/docs/guides/http/server" },
    ],
  },
  defer: {
    description: "Marks loader return data as deferred so promise-backed keys can stream progressively.",
    links: [
      { label: "Loaders", href: "/docs/data/loaders" },
      { label: "Streaming and Deferred", href: "/docs/rendering/streaming-deferred" },
    ],
  },
  DeferredLoaderResult: {
    description: "Typed wrapper returned by `defer()` for loaders with immediate and deferred values.",
    links: [{ label: "Loaders", href: "/docs/data/loaders" }],
  },
  DeferredToken: {
    description: "Serialized payload token used internally to revive deferred values during hydration.",
    links: [{ label: "Streaming and Deferred", href: "/docs/rendering/streaming-deferred" }],
  },
  defineConfig: {
    description: "Helper for authoring typed `rbssr.config.ts` configuration.",
    links: [{ label: "Configuration", href: "/docs/deployment/configuration" }],
  },
  FrameworkConfig: {
    description: "Main framework configuration surface for paths, server mode, response headers, and server bytecode behavior.",
    links: [{ label: "Configuration", href: "/docs/deployment/configuration" }],
  },
  json: {
    description: "Creates a JSON `Response` with a default UTF-8 content-type.",
    links: [{ label: "API Overview", href: "/docs/api/overview" }],
  },
  Loader: {
    description: "Route loader function signature for GET/HEAD data requests.",
    links: [{ label: "Loaders", href: "/docs/data/loaders" }],
  },
  LoaderContext: {
    description: "Context object passed to loaders with URL, params, mutable locals, and framework-normalized cookies exposed as `Map<string, string>` rather than Bun's `CookieMap`.",
    links: [
      { label: "Loaders", href: "/docs/data/loaders" },
      { label: "Bun Runtime APIs", href: "/docs/api/bun-runtime-apis" },
      { label: "Cookies", href: "https://bun.com/docs/api/cookie" },
      { label: "HTTP server cookies", href: "https://bun.com/docs/runtime/http/cookies" },
    ],
  },
  LoaderResult: {
    description: "Allowed return union for loaders, including plain data, redirects, deferred data, and `Response`.",
    links: [{ label: "Loaders", href: "/docs/data/loaders" }],
  },
  Middleware: {
    description: "Middleware function contract executed around page and API handlers.",
    links: [{ label: "Layouts and Groups", href: "/docs/routing/layouts-and-groups" }],
  },
  Outlet: {
    description: "Renders the next nested route element inside root/layout route modules.",
    links: [{ label: "Layouts and Groups", href: "/docs/routing/layouts-and-groups" }],
  },
  Params: {
    description: "Dynamic URL params object shape exposed to loaders, actions, and hooks.",
    links: [{ label: "File-Based Routing", href: "/docs/routing/file-based-routing" }],
  },
  notFound: {
    description: "Throws a typed caught 404 route error for nearest not-found/catch boundary handling.",
    links: [{ label: "Error Handling", href: "/docs/data/error-handling" }],
  },
  redirect: {
    description: "Returns a framework redirect descriptor consumed by loader/action runtime flow.",
    links: [{ label: "Actions", href: "/docs/data/actions" }],
  },
  RedirectResult: {
    description: "Redirect descriptor shape with destination and HTTP redirect status.",
    links: [{ label: "Actions", href: "/docs/data/actions" }],
  },
  RequestContext: {
    description: "Base request context shared by middleware, loaders, actions, and API handlers, including framework-normalized cookies as `Map<string, string>` rather than Bun's `CookieMap`.",
    links: [
      { label: "Layouts and Groups", href: "/docs/routing/layouts-and-groups" },
      { label: "Bun Runtime APIs", href: "/docs/api/bun-runtime-apis" },
      { label: "Cookies", href: "https://bun.com/docs/api/cookie" },
      { label: "HTTP server cookies", href: "https://bun.com/docs/runtime/http/cookies" },
    ],
  },
  routeError: {
    description: "Throws a typed caught route error with status/data for TanStack-style catch-boundary flows.",
    links: [{ label: "Error Handling", href: "/docs/data/error-handling" }],
  },
  RouteCatchContext: {
    description: "Context passed to `onCatch` lifecycle hooks when a typed caught route error is handled.",
    links: [{ label: "Error Handling", href: "/docs/data/error-handling" }],
  },
  RouteErrorContext: {
    description: "Context passed to `onError` lifecycle hooks for uncaught route failures.",
    links: [{ label: "Error Handling", href: "/docs/data/error-handling" }],
  },
  RouteErrorResponse: {
    description: "Serializable caught route-error shape used by catch boundaries and transition payloads.",
    links: [{ label: "Error Handling", href: "/docs/data/error-handling" }],
  },
  isRouteErrorResponse: {
    description: "Type guard for narrowing unknown errors to framework caught route errors.",
    links: [{ label: "Error Handling", href: "/docs/data/error-handling" }],
  },
  ResponseHeaderRule: {
    description: "Path-based response header rule used by `FrameworkConfig.headers`.",
    links: [{ label: "Configuration", href: "/docs/deployment/configuration" }],
  },
  RouteModule: {
    description: "Page route module contract including component and optional route lifecycle exports.",
    links: [{ label: "File-Based Routing", href: "/docs/routing/file-based-routing" }],
  },
  Router: {
    description: "Programmatic navigation contract returned by `useRouter`.",
    links: [{ label: "Navigation", href: "/docs/routing/navigation" }],
  },
  RouterNavigateOptions: {
    description: "Options accepted by `router.push()` and `router.replace()`.",
    links: [{ label: "Navigation", href: "/docs/routing/navigation" }],
  },
  startHttpServer: {
    description: "Starts Bun HTTP server for configured framework runtime.",
    links: [
      { label: "Bun Runtime APIs", href: "/docs/api/bun-runtime-apis" },
      { label: "Bun-only deployment", href: "/docs/deployment/bun-deployment" },
      { label: "Bun APIs", href: "https://bun.com/docs/runtime/bun-apis" },
      { label: "Common HTTP server usage", href: "https://bun.com/docs/guides/http/server" },
    ],
  },
  useLoaderData: {
    description: "Reads loader data in route components, including deferred values as promises.",
    links: [{ label: "Loaders", href: "/docs/data/loaders" }],
  },
  useParams: {
    description: "Returns dynamic route params for the current matched route.",
    links: [{ label: "File-Based Routing", href: "/docs/routing/file-based-routing" }],
  },
  useRouter: {
    description: "Returns a Next.js-style router object for programmatic client transitions.",
    links: [{ label: "Navigation", href: "/docs/routing/navigation" }],
  },
  useRequestUrl: {
    description: "Returns the current request URL object in route components.",
    links: [{ label: "Loaders", href: "/docs/data/loaders" }],
  },
  useRouteError: {
    description: "Reads error values inside `ErrorBoundary` route components.",
    links: [{ label: "Error Handling", href: "/docs/data/error-handling" }],
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
navTitle: ${file.title}
description: ${file.description}
section: ${file.section}
order: ${file.order}
kind: api
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
      section: "API",
      order: 3,
      intro:
        "Import from `react-bun-ssr` for runtime startup APIs, config helpers, response helpers, and deployment-facing types. Start here when you are wiring Bun server startup or authoring `rbssr.config.ts`.",
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
  return redirect("/docs/data/actions");
}`,
        },
      ],
    },
    {
      slug: "react-bun-ssr-route",
      source: path.join(ROOT, "framework/runtime/route-api.ts"),
      title: "react-bun-ssr/route",
      description: "Route module contracts, hooks, and helpers exposed to application routes.",
      section: "API",
      order: 4,
      intro:
        "Use this entrypoint inside route modules for hooks, route contract types, navigation helpers, and TanStack-style route error primitives. It is the package you import from day-to-day while building routes.",
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
  return redirect("/docs/data/actions");
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
