import path from 'node:path';
import { isRouteActionStub } from './action-stub';
import { ensureDir, existsPath } from './io';
import type {
  ApiRouteModule,
  Middleware,
  RouteModule,
  RouteModuleBundle,
} from './types';
import { stableHash, toFileImportUrl } from './utils';

const serverBundlePathCache = new Map<string, Promise<string>>();
const BUILD_OPTIMIZE_IMPORTS = [
  'react-bun-ssr',
  'react-bun-ssr/route',
  'react',
  'react-dom',
];
const SERVER_BUILD_EXTERNAL = [
  'react',
  'react-dom',
  'react-dom/server',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'react-bun-ssr',
  'react-bun-ssr/route',
];

export interface RouteModuleLoadOptions {
  cacheBustKey?: string;
  serverBytecode?: boolean;
  devSourceImports?: boolean;
  nodeEnv?: "development" | "production";
  companionFilePath?: string | null;
}

const ROUTE_SERVER_EXPORT_KEYS = new Set([
  "loader",
  "action",
  "middleware",
  "head",
  "meta",
  "onError",
  "onCatch",
]);

export function createServerModuleCacheKey(options: {
  absoluteFilePath: string;
  cacheBustKey?: string;
  serverBytecode: boolean;
  nodeEnv?: "development" | "production";
}): string {
  const nodeEnv = options.nodeEnv ?? (process.env.NODE_ENV === "production" ? "production" : "development");
  return `${options.absoluteFilePath}|${options.cacheBustKey ?? 'prod'}|bytecode:${options.serverBytecode ? '1' : '0'}|env:${nodeEnv}|bun:${Bun.version}`;
}

export function createServerBuildConfig(options: {
  absoluteFilePath: string;
  outDir: string;
  serverBytecode: boolean;
  nodeEnv?: "development" | "production";
}): Bun.BuildConfig {
  const nodeEnv = options.nodeEnv ?? (process.env.NODE_ENV === "production" ? "production" : "development");
  return {
    entrypoints: [options.absoluteFilePath],
    outdir: options.outDir,
    target: 'bun',
    format: options.serverBytecode ? 'cjs' : 'esm',
    bytecode: options.serverBytecode,
    optimizeImports: BUILD_OPTIMIZE_IMPORTS,
    splitting: false,
    sourcemap: 'none',
    minify: false,
    naming: 'entry-[hash].[ext]',
    external: SERVER_BUILD_EXTERNAL,
    define: {
      "process.env.NODE_ENV": JSON.stringify(nodeEnv),
    },
  };
}

export async function importModule<T>(
  filePath: string,
  cacheBustKey?: string,
): Promise<T> {
  const baseUrl = toFileImportUrl(filePath);
  const url = cacheBustKey ? `${baseUrl}?v=${cacheBustKey}` : baseUrl;
  return (await import(url)) as T;
}

function normalizeLoadOptions(
  options: string | RouteModuleLoadOptions | undefined,
): RouteModuleLoadOptions {
  if (typeof options === "string") {
    return {
      cacheBustKey: options,
    };
  }

  return options ?? {};
}

export function toServerCompanionPath(filePath: string): string {
  const extension = path.extname(filePath);
  if (!extension) {
    return `${filePath}.server`;
  }
  return `${filePath.slice(0, -extension.length)}.server${extension}`;
}

async function resolveServerCompanionFilePath(
  filePath: string,
  options: RouteModuleLoadOptions,
): Promise<string | null> {
  if (options.companionFilePath === null) {
    return null;
  }

  if (typeof options.companionFilePath === "string") {
    return options.companionFilePath;
  }

  const companionFilePath = toServerCompanionPath(filePath);
  if (await existsPath(companionFilePath)) {
    return companionFilePath;
  }
  return null;
}

async function loadRawModuleRecord(
  filePath: string,
  options: RouteModuleLoadOptions,
): Promise<Record<string, unknown>> {
  const modulePath = options.devSourceImports
    ? path.resolve(filePath)
    : await buildServerModule(filePath, options);
  return unwrapModuleNamespace(await importModule<Record<string, unknown>>(
    modulePath,
    options.cacheBustKey,
  ));
}

function toRouteModule(filePath: string, moduleValue: unknown): RouteModule {
  const rawValue = moduleValue as Record<string, unknown>;
  const value = unwrapModuleNamespace(rawValue) as Partial<RouteModule>;
  const component = value.default;

  if (typeof component !== 'function') {
    const exportKeys =
      value && typeof value === 'object' ? Object.keys(value) : [];
    throw new Error(
      `Route module ${filePath} must export a default React component. ` +
        `Received exports: ${Bun.inspect(exportKeys)}`,
    );
  }

  return {
    ...value,
    default: component,
  } as RouteModule;
}

function toRouteServerCompanionExports(
  filePath: string,
  companionFilePath: string,
  moduleValue: Record<string, unknown>,
): Partial<RouteModule> {
  const exportKeys = Object.keys(moduleValue).filter(key => key !== "__esModule");

  if (exportKeys.includes("default")) {
    throw new Error(
      `Route companion module ${companionFilePath} cannot export default. ` +
        `Move UI exports back to ${filePath}.`,
    );
  }

  const unsupportedExports = exportKeys.filter(key => !ROUTE_SERVER_EXPORT_KEYS.has(key));
  if (unsupportedExports.length > 0) {
    throw new Error(
      `Route companion module ${companionFilePath} has unsupported exports: ${unsupportedExports.join(", ")}. ` +
        `Allowed exports: ${[...ROUTE_SERVER_EXPORT_KEYS].join(", ")}.`,
    );
  }

  const companionExports: Partial<RouteModule> = {};
  for (const key of exportKeys) {
    (companionExports as Record<string, unknown>)[key] = moduleValue[key];
  }
  return companionExports;
}

function mergeRouteModuleWithCompanion(options: {
  filePath: string;
  companionFilePath: string;
  routeModule: RouteModule;
  companionExports: Partial<RouteModule>;
}): RouteModule {
  for (const key of ROUTE_SERVER_EXPORT_KEYS) {
    if (options.companionExports[key as keyof RouteModule] === undefined) {
      continue;
    }

    if (
      key === "action"
      && isRouteActionStub(options.routeModule.action)
    ) {
      continue;
    }

    if (options.routeModule[key as keyof RouteModule] !== undefined) {
      throw new Error(
        `Duplicate server export "${key}" found in both ${options.filePath} and ${options.companionFilePath}. ` +
          `Keep "${key}" in only one file.`,
      );
    }
  }

  return {
    ...options.routeModule,
    ...options.companionExports,
  };
}

function stripRouteActionStub(routeModule: RouteModule): RouteModule {
  if (!isRouteActionStub(routeModule.action)) {
    return routeModule;
  }

  const { action: _stubAction, ...rest } = routeModule;
  return rest as RouteModule;
}

function unwrapModuleNamespace(moduleValue: Record<string, unknown>): Record<string, unknown> {
  if (
    !moduleValue
    || typeof moduleValue.default !== "object"
    || moduleValue.default === null
  ) {
    return moduleValue;
  }

  const defaultNamespace = moduleValue.default as Record<string, unknown>;

  if ("default" in defaultNamespace) {
    return defaultNamespace;
  }

  const namedExportKeys = Object.keys(moduleValue).filter(key => {
    return key !== "default" && key !== "__esModule";
  });

  if (
    namedExportKeys.length > 0
    && namedExportKeys.every(key => {
      return Object.prototype.hasOwnProperty.call(defaultNamespace, key)
        && defaultNamespace[key] === moduleValue[key];
    })
  ) {
    return defaultNamespace;
  }

  return moduleValue;
}

function isCompilableRouteModule(filePath: string): boolean {
  return /\.(tsx|jsx|ts|js)$/.test(filePath);
}

async function buildServerModule(
  filePath: string,
  options: RouteModuleLoadOptions = {},
): Promise<string> {
  const absoluteFilePath = path.resolve(filePath);
  if (!isCompilableRouteModule(absoluteFilePath)) {
    return absoluteFilePath;
  }

  const cacheBustKey = options.cacheBustKey;
  const serverBytecode = options.serverBytecode ?? true;
  const nodeEnv = options.nodeEnv ?? (process.env.NODE_ENV === "production" ? "production" : "development");
  const cacheKey = createServerModuleCacheKey({
    absoluteFilePath,
    cacheBustKey,
    serverBytecode,
    nodeEnv,
  });
  const existing = serverBundlePathCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const pending = (async () => {
    const outDir = path.join(
      process.cwd(),
      '.rbssr',
      'cache',
      'server-modules',
      stableHash(cacheKey),
    );
    await ensureDir(outDir);

    const buildResult = await Bun.build(
      createServerBuildConfig({
        absoluteFilePath,
        outDir,
        serverBytecode,
        nodeEnv,
      }),
    );

    if (!buildResult.success && serverBytecode) {
      const bytecodeMessages = buildResult.logs
        .map((log) => log.message)
        .join('\n');
      // eslint-disable-next-line no-console
      console.warn(
        `[rbssr] bytecode build failed for ${absoluteFilePath}; falling back to non-bytecode build.\n${bytecodeMessages}`,
      );
      const fallbackResult = await Bun.build(
        createServerBuildConfig({
          absoluteFilePath,
          outDir,
          serverBytecode: false,
          nodeEnv,
        }),
      );

      if (!fallbackResult.success) {
        const messages = fallbackResult.logs
          .map((log) => `${log.message}\n${Bun.inspect(log)}`)
          .join('\n');
        throw new Error(
          `Server module build failed for ${absoluteFilePath}\n${messages}`,
        );
      }

      const outputPath = fallbackResult.outputs.find((output) =>
        output.path.endsWith('.js'),
      )?.path;
      if (!outputPath) {
        throw new Error(
          `Server module build produced no JavaScript output for ${absoluteFilePath}\n` +
            `outputs: ${Bun.inspect(fallbackResult.outputs.map((output) => output.path))}`,
        );
      }

      return outputPath;
    }

    if (!buildResult.success) {
      const messages = buildResult.logs
        .map((log) => `${log.message}\n${Bun.inspect(log)}`)
        .join('\n');
      throw new Error(
        `Server module build failed for ${absoluteFilePath}\n${messages}`,
      );
    }

    const outputPath = buildResult.outputs.find((output) =>
      output.path.endsWith('.js'),
    )?.path;
    if (!outputPath) {
      throw new Error(
        `Server module build produced no JavaScript output for ${absoluteFilePath}\n` +
          `outputs: ${Bun.inspect(buildResult.outputs.map((output) => output.path))}`,
      );
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
  options: RouteModuleLoadOptions = {},
): Promise<RouteModule> {
  const normalizedOptions = normalizeLoadOptions(options);
  const baseModuleValue = await loadRawModuleRecord(filePath, normalizedOptions);
  const routeModule = toRouteModule(filePath, baseModuleValue);
  const companionFilePath = await resolveServerCompanionFilePath(filePath, normalizedOptions);
  if (!companionFilePath) {
    return stripRouteActionStub(routeModule);
  }

  const companionModuleValue = await loadRawModuleRecord(companionFilePath, normalizedOptions);
  const companionExports = toRouteServerCompanionExports(filePath, companionFilePath, companionModuleValue);
  const mergedRouteModule = mergeRouteModuleWithCompanion({
    filePath,
    companionFilePath,
    routeModule,
    companionExports,
  });
  return stripRouteActionStub(mergedRouteModule);
}

export async function loadRouteModules(options: {
  rootFilePath: string;
  layoutFiles: string[];
  routeFilePath: string;
  routeServerFilePath?: string;
  cacheBustKey?: string;
  serverBytecode?: boolean;
  devSourceImports?: boolean;
}): Promise<RouteModuleBundle> {
  const moduleOptions: RouteModuleLoadOptions = {
    cacheBustKey: options.cacheBustKey,
    serverBytecode: options.serverBytecode,
    devSourceImports: options.devSourceImports,
  };
  const [root, layouts, route] = await Promise.all([
    loadRouteModule(options.rootFilePath, moduleOptions),
    Promise.all(
      options.layoutFiles.map((layoutFilePath) =>
        loadRouteModule(layoutFilePath, moduleOptions),
      ),
    ),
    loadRouteModule(options.routeFilePath, {
      ...moduleOptions,
      companionFilePath: options.routeServerFilePath,
    }),
  ]);

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
    return value.filter(
      (item): item is Middleware => typeof item === 'function',
    );
  }

  if (typeof value === 'function') {
    return [value as Middleware];
  }

  return [];
}

async function resolveGlobalMiddlewarePath(middlewareFilePath: string): Promise<string | null> {
  const basePath = path.resolve(middlewareFilePath);
  const serverPath = toServerCompanionPath(basePath);
  const [baseExists, serverExists] = await Promise.all([
    existsPath(basePath),
    existsPath(serverPath),
  ]);

  if (baseExists && serverExists) {
    throw new Error(
      `Global middleware file collision: both ${basePath} and ${serverPath} exist. ` +
        "Use only one of these files.",
    );
  }

  if (serverExists) {
    return serverPath;
  }
  if (baseExists) {
    return basePath;
  }

  return null;
}

export async function loadGlobalMiddleware(
  middlewareFilePath: string,
  options: string | RouteModuleLoadOptions = {},
): Promise<Middleware[]> {
  const resolvedMiddlewarePath = await resolveGlobalMiddlewarePath(middlewareFilePath);
  if (!resolvedMiddlewarePath) {
    return [];
  }

  const normalizedOptions = normalizeLoadOptions(options);
  const raw = await loadRawModuleRecord(resolvedMiddlewarePath, normalizedOptions);

  return [
    ...normalizeMiddlewareExport(raw.default),
    ...normalizeMiddlewareExport(raw.middleware),
  ];
}

export async function loadNestedMiddleware(
  middlewareFilePaths: string[],
  options: string | RouteModuleLoadOptions = {},
): Promise<Middleware[]> {
  const normalizedOptions = normalizeLoadOptions(options);
  const rawModules = await Promise.all(
    middlewareFilePaths.map(async (middlewareFilePath) => {
      return loadRawModuleRecord(middlewareFilePath, normalizedOptions);
    }),
  );

  return rawModules.flatMap((raw) => {
    return [
      ...normalizeMiddlewareExport(raw.default),
      ...normalizeMiddlewareExport(raw.middleware),
    ];
  });
}

export function extractRouteMiddleware(module: RouteModule): Middleware[] {
  return normalizeMiddlewareExport(module.middleware);
}

export async function loadApiRouteModule(
  filePath: string,
  options: string | RouteModuleLoadOptions = {},
): Promise<ApiRouteModule> {
  const normalizedOptions = normalizeLoadOptions(options);
  return await loadRawModuleRecord(filePath, normalizedOptions) as ApiRouteModule;
}
