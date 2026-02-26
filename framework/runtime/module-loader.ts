import path from 'node:path';
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
  '@datadog/browser-rum-react',
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
}

export function createServerModuleCacheKey(options: {
  absoluteFilePath: string;
  cacheBustKey?: string;
  serverBytecode: boolean;
}): string {
  return `${options.absoluteFilePath}|${options.cacheBustKey ?? 'prod'}|bytecode:${options.serverBytecode ? '1' : '0'}|bun:${Bun.version}`;
}

export function createServerBuildConfig(options: {
  absoluteFilePath: string;
  outDir: string;
  serverBytecode: boolean;
}): Bun.BuildConfig {
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

function toRouteModule(filePath: string, moduleValue: unknown): RouteModule {
  const rawValue = moduleValue as Record<string, unknown>;
  const value =
    rawValue
      && typeof rawValue.default === 'object'
      && rawValue.default !== null
      && 'default' in (rawValue.default as Record<string, unknown>)
      ? (rawValue.default as Partial<RouteModule>)
      : (rawValue as Partial<RouteModule>);
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
  const cacheKey = createServerModuleCacheKey({
    absoluteFilePath,
    cacheBustKey,
    serverBytecode,
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
  const bundledModulePath = await buildServerModule(filePath, options);
  const moduleValue = await importModule<unknown>(
    bundledModulePath,
    options.cacheBustKey,
  );
  return toRouteModule(filePath, moduleValue);
}

export async function loadRouteModules(options: {
  rootFilePath: string;
  layoutFiles: string[];
  routeFilePath: string;
  cacheBustKey?: string;
  serverBytecode?: boolean;
}): Promise<RouteModuleBundle> {
  const moduleOptions: RouteModuleLoadOptions = {
    cacheBustKey: options.cacheBustKey,
    serverBytecode: options.serverBytecode,
  };
  const [root, layouts, route] = await Promise.all([
    loadRouteModule(options.rootFilePath, moduleOptions),
    Promise.all(
      options.layoutFiles.map((layoutFilePath) =>
        loadRouteModule(layoutFilePath, moduleOptions),
      ),
    ),
    loadRouteModule(options.routeFilePath, moduleOptions),
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

export async function loadGlobalMiddleware(
  middlewareFilePath: string,
  cacheBustKey?: string,
): Promise<Middleware[]> {
  if (!(await existsPath(middlewareFilePath))) {
    return [];
  }

  const raw = await importModule<Record<string, unknown>>(
    middlewareFilePath,
    cacheBustKey,
  );

  return [
    ...normalizeMiddlewareExport(raw.default),
    ...normalizeMiddlewareExport(raw.middleware),
  ];
}

export async function loadNestedMiddleware(
  middlewareFilePaths: string[],
  cacheBustKey?: string,
): Promise<Middleware[]> {
  const rawModules = await Promise.all(
    middlewareFilePaths.map((middlewareFilePath) => {
      return importModule<Record<string, unknown>>(
        middlewareFilePath,
        cacheBustKey,
      );
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
  cacheBustKey?: string,
): Promise<ApiRouteModule> {
  const raw = await importModule<ApiRouteModule>(filePath, cacheBustKey);
  return raw;
}
