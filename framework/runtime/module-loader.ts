import path from "node:path";
import { ensureDir, existsPath } from "./io";
import type {
  ApiRouteModule,
  Middleware,
  RouteModule,
  RouteModuleBundle,
} from "./types";
import { stableHash, toFileImportUrl } from "./utils";

const serverBundlePathCache = new Map<string, Promise<string>>();

export async function importModule<T>(
  filePath: string,
  cacheBustKey?: string,
): Promise<T> {
  const baseUrl = toFileImportUrl(filePath);
  const url = cacheBustKey ? `${baseUrl}?v=${cacheBustKey}` : baseUrl;
  return (await import(url)) as T;
}

function toRouteModule(filePath: string, moduleValue: unknown): RouteModule {
  const value = moduleValue as Partial<RouteModule>;
  const component = value.default;

  if (typeof component !== "function") {
    throw new Error(`Route module ${filePath} must export a default React component`);
  }

  return {
    ...value,
    default: component,
  } as RouteModule;
}

function isCompilableRouteModule(filePath: string): boolean {
  return /\.(tsx|jsx|ts|js)$/.test(filePath);
}

async function buildServerModule(filePath: string, cacheBustKey?: string): Promise<string> {
  const absoluteFilePath = path.resolve(filePath);
  if (!isCompilableRouteModule(absoluteFilePath)) {
    return absoluteFilePath;
  }

  const cacheKey = `${absoluteFilePath}|${cacheBustKey ?? "prod"}`;
  const existing = serverBundlePathCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const pending = (async () => {
    const outDir = path.join(
      process.cwd(),
      ".rbssr",
      "cache",
      "server-modules",
      stableHash(cacheKey),
    );
    await ensureDir(outDir);

    const buildResult = await Bun.build({
      entrypoints: [absoluteFilePath],
      outdir: outDir,
      target: "bun",
      format: "esm",
      splitting: false,
      sourcemap: "none",
      minify: false,
      naming: "entry-[hash].[ext]",
      external: [
        "react",
        "react-dom",
        "react-dom/server",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "react-bun-ssr",
        "react-bun-ssr/route",
      ],
    });

    if (!buildResult.success) {
      const messages = buildResult.logs.map(log => log.message).join("\n");
      throw new Error(`Server module build failed for ${absoluteFilePath}\n${messages}`);
    }

    const outputPath = buildResult.outputs.find(output => output.path.endsWith(".js"))?.path;
    if (!outputPath) {
      throw new Error(`Server module build produced no JavaScript output for ${absoluteFilePath}`);
    }

    return outputPath;
  })();

  serverBundlePathCache.set(cacheKey, pending);

  try {
    return await pending;
  } catch (error) {
    serverBundlePathCache.delete(cacheKey);
    throw error;
  }
}

export async function loadRouteModule(
  filePath: string,
  cacheBustKey?: string,
): Promise<RouteModule> {
  const bundledModulePath = await buildServerModule(filePath, cacheBustKey);
  const moduleValue = await importModule<unknown>(bundledModulePath);
  return toRouteModule(filePath, moduleValue);
}

export async function loadRouteModules(options: {
  rootFilePath: string;
  layoutFiles: string[];
  routeFilePath: string;
  cacheBustKey?: string;
}): Promise<RouteModuleBundle> {
  const root = await loadRouteModule(options.rootFilePath, options.cacheBustKey);

  const layouts: RouteModule[] = [];
  for (const layoutFilePath of options.layoutFiles) {
    layouts.push(await loadRouteModule(layoutFilePath, options.cacheBustKey));
  }

  const route = await loadRouteModule(options.routeFilePath, options.cacheBustKey);

  return {
    root,
    layouts,
    route,
  };
}

function normalizeMiddlewareExport(value: unknown): Middleware[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter((item): item is Middleware => typeof item === "function");
  }

  if (typeof value === "function") {
    return [value as Middleware];
  }

  return [];
}

export async function loadGlobalMiddleware(
  middlewareFilePath: string,
  cacheBustKey?: string,
): Promise<Middleware[]> {
  if (!(await existsPath(middlewareFilePath))) {
    return [];
  }

  const raw = await importModule<Record<string, unknown>>(middlewareFilePath, cacheBustKey);

  return [
    ...normalizeMiddlewareExport(raw.default),
    ...normalizeMiddlewareExport(raw.middleware),
  ];
}

export async function loadNestedMiddleware(
  middlewareFilePaths: string[],
  cacheBustKey?: string,
): Promise<Middleware[]> {
  const result: Middleware[] = [];

  for (const middlewareFilePath of middlewareFilePaths) {
    const raw = await importModule<Record<string, unknown>>(middlewareFilePath, cacheBustKey);
    result.push(...normalizeMiddlewareExport(raw.default), ...normalizeMiddlewareExport(raw.middleware));
  }

  return result;
}

export function extractRouteMiddleware(module: RouteModule): Middleware[] {
  return normalizeMiddlewareExport(module.middleware);
}

export async function loadApiRouteModule(
  filePath: string,
  cacheBustKey?: string,
): Promise<ApiRouteModule> {
  const raw = await importModule<ApiRouteModule>(filePath, cacheBustKey);
  return raw;
}
