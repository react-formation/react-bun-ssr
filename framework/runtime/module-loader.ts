import fs from "node:fs";
import type {
  ApiRouteModule,
  Middleware,
  RouteModule,
  RouteModuleBundle,
} from "./types";
import { toFileImportUrl } from "./utils";

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

export async function loadRouteModules(options: {
  rootFilePath: string;
  layoutFiles: string[];
  routeFilePath: string;
  cacheBustKey?: string;
}): Promise<RouteModuleBundle> {
  const rootRaw = await importModule<unknown>(options.rootFilePath, options.cacheBustKey);
  const root = toRouteModule(options.rootFilePath, rootRaw);

  const layouts: RouteModule[] = [];
  for (const layoutFilePath of options.layoutFiles) {
    const layoutRaw = await importModule<unknown>(layoutFilePath, options.cacheBustKey);
    layouts.push(toRouteModule(layoutFilePath, layoutRaw));
  }

  const routeRaw = await importModule<unknown>(options.routeFilePath, options.cacheBustKey);
  const route = toRouteModule(options.routeFilePath, routeRaw);

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
  if (!fs.existsSync(middlewareFilePath)) {
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
