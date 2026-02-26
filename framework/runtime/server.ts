import path from "node:path";
import { createBunRouteAdapter, type BunRouteAdapter } from "./bun-route-adapter";
import { statPath } from "./io";
import type {
  ActionContext,
  BuildRouteAsset,
  FrameworkConfig,
  LoaderContext,
  RequestContext,
  ResolvedConfig,
  RouteModule,
  ServerRuntimeOptions,
} from "./types";
import { resolveConfig } from "./config";
import { isRedirectResult, json } from "./helpers";
import {
  extractRouteMiddleware,
  loadApiRouteModule,
  loadGlobalMiddleware,
  loadNestedMiddleware,
  loadRouteModule,
  loadRouteModules,
} from "./module-loader";
import {
  collectHeadMarkup,
  renderDocument,
  renderErrorApp,
  renderNotFoundApp,
  renderPageApp,
} from "./render";
import { runMiddlewareChain } from "./middleware";
import {
  ensureWithin,
  isMutatingMethod,
  normalizeSlashes,
  parseCookieHeader,
  sanitizeErrorMessage,
} from "./utils";

type ResponseKind = "static" | "html" | "api" | "internal-dev";

const HASHED_CLIENT_CHUNK_RE = /^\/client\/.+-[A-Za-z0-9]{6,}\.(?:js|css)$/;
const STATIC_IMMUTABLE_CACHE = "public, max-age=31536000, immutable";
const STATIC_DEFAULT_CACHE = "public, max-age=3600";

function toRedirectResponse(location: string, status = 302): Response {
  return Response.redirect(location, status);
}

function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

function toHtmlResponse(html: string, status: number): Response {
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}

function applyFrameworkDefaultHeaders(options: {
  headers: Headers;
  dev: boolean;
  kind: ResponseKind;
  pathname: string;
}): void {
  const { headers, dev, kind, pathname } = options;

  if (kind === "internal-dev") {
    if (!headers.has("cache-control")) {
      headers.set("cache-control", "no-store");
    }
    return;
  }

  if (dev) {
    if (kind === "static") {
      headers.set("cache-control", "no-store");
      headers.set("pragma", "no-cache");
      headers.set("expires", "0");
    }
    return;
  }

  if (kind === "static" && !headers.has("cache-control")) {
    headers.set(
      "cache-control",
      HASHED_CLIENT_CHUNK_RE.test(pathname) ? STATIC_IMMUTABLE_CACHE : STATIC_DEFAULT_CACHE,
    );
  }
}

function applyConfiguredHeaders(options: {
  headers: Headers;
  pathname: string;
  config: ResolvedConfig;
}): void {
  const { headers, pathname, config } = options;
  for (const rule of config.headerRules) {
    if (!rule.matcher.test(pathname)) {
      continue;
    }

    for (const [name, value] of Object.entries(rule.headers)) {
      headers.set(name, value);
    }
  }
}

function finalizeResponseHeaders(options: {
  response: Response;
  request: Request;
  pathname: string;
  kind: ResponseKind;
  dev: boolean;
  config: ResolvedConfig;
}): Response {
  const headers = new Headers(options.response.headers);

  applyFrameworkDefaultHeaders({
    headers,
    dev: options.dev,
    kind: options.kind,
    pathname: options.pathname,
  });

  applyConfiguredHeaders({
    headers,
    pathname: options.pathname,
    config: options.config,
  });

  return new Response(options.request.method.toUpperCase() === "HEAD" ? null : options.response.body, {
    status: options.response.status,
    statusText: options.response.statusText,
    headers,
  });
}

async function tryServeStatic(baseDir: string, pathname: string): Promise<Response | null> {
  if (!pathname || pathname === "/") {
    return null;
  }

  const decodedPath = decodeURIComponent(pathname);
  const relativePath = decodedPath.replace(/^\/+/, "");

  if (!relativePath) {
    return null;
  }

  const resolved = ensureWithin(baseDir, relativePath);
  if (!resolved) {
    return null;
  }

  const stat = await statPath(resolved);
  if (!stat?.isFile()) {
    return null;
  }

  return new Response(Bun.file(resolved));
}

function getMethodHandler(moduleValue: Record<string, unknown>, method: string): unknown {
  const upper = method.toUpperCase();
  if (upper === "HEAD" && typeof moduleValue.HEAD !== "function" && typeof moduleValue.GET === "function") {
    return moduleValue.GET;
  }
  return moduleValue[upper];
}

function getAllowedMethods(moduleValue: Record<string, unknown>): string[] {
  return ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].filter(method => {
    return typeof moduleValue[method] === "function";
  });
}

async function parseActionBody(request: Request): Promise<Pick<ActionContext, "formData" | "json">> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      return { json: await request.json() };
    } catch {
      return {};
    }
  }

  if (
    contentType.includes("multipart/form-data") ||
    contentType.includes("application/x-www-form-urlencoded")
  ) {
    try {
      return { formData: await request.formData() };
    } catch {
      return {};
    }
  }

  return {};
}

async function loadRootOnlyModule(
  rootModulePath: string,
  cacheBustKey?: string,
): Promise<RouteModule> {
  return loadRouteModule(rootModulePath, cacheBustKey);
}

function resolveRouteAssets(
  routeId: string,
  options: {
    dev: boolean;
    runtimeOptions: ServerRuntimeOptions;
  },
): BuildRouteAsset | null {
  const { dev, runtimeOptions } = options;
  if (dev) {
    const assets = runtimeOptions.getDevAssets?.() ?? runtimeOptions.devAssets ?? {};
    return assets[routeId] ?? null;
  }

  const manifest = runtimeOptions.buildManifest;
  if (!manifest) {
    return null;
  }

  return manifest.routes[routeId] ?? null;
}

function createDevReloadEventStream(options: {
  getVersion: () => number;
  subscribe?: (listener: (version: number) => void) => (() => void) | void;
}): Response {
  const encoder = new TextEncoder();
  let interval: ReturnType<typeof setInterval> | undefined;
  let unsubscribe: (() => void) | void;
  let cleanup: (() => void) | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      cleanup = (): void => {
        if (closed) {
          return;
        }
        closed = true;
        if (interval) {
          clearInterval(interval);
          interval = undefined;
        }
        if (typeof unsubscribe === "function") {
          unsubscribe();
          unsubscribe = undefined;
        }
      };

      const sendChunk = (chunk: string): void => {
        if (closed) {
          return;
        }
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup?.();
        }
      };

      const sendReload = (version: number): void => {
        sendChunk(`event: reload\ndata: ${version}\n\n`);
      };

      sendChunk(": connected\n\n");
      sendReload(options.getVersion());

      unsubscribe = options.subscribe?.(nextVersion => {
        sendReload(nextVersion);
      });

      interval = setInterval(() => {
        sendChunk(": ping\n\n");
      }, 15_000);
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}

export function createServer(
  config: FrameworkConfig = {},
  runtimeOptions: ServerRuntimeOptions = {},
): { fetch(req: Request): Promise<Response> } {
  const resolvedConfig: ResolvedConfig = resolveConfig(config);

  const dev = runtimeOptions.dev ?? resolvedConfig.mode !== "production";

  const adapterCache = new Map<string, BunRouteAdapter>();
  const pendingAdapterCache = new Map<string, Promise<BunRouteAdapter>>();

  const getAdapterKey = (activeConfig: ResolvedConfig): string => {
    const reloadVersion = dev ? runtimeOptions.reloadVersion?.() ?? 0 : 0;
    return `${normalizeSlashes(activeConfig.routesDir)}|${dev ? "dev" : "prod"}|${reloadVersion}`;
  };

  const trimAdapterCache = (): void => {
    if (!dev || adapterCache.size <= 3) {
      return;
    }

    const keys = [...adapterCache.keys()];
    while (keys.length > 3) {
      const oldestKey = keys.shift();
      if (!oldestKey) {
        break;
      }
      adapterCache.delete(oldestKey);
      pendingAdapterCache.delete(oldestKey);
    }
  };

  const getRouteAdapter = async (activeConfig: ResolvedConfig): Promise<BunRouteAdapter> => {
    const cacheKey = getAdapterKey(activeConfig);
    const cached = adapterCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const pending = pendingAdapterCache.get(cacheKey);
    if (pending) {
      return pending;
    }

    const reloadVersion = dev ? runtimeOptions.reloadVersion?.() ?? 0 : 0;
    const projectionRootDir = dev
      ? path.resolve(activeConfig.cwd, ".rbssr/generated/router-projection", `dev-v${reloadVersion}`)
      : path.resolve(activeConfig.cwd, ".rbssr/generated/router-projection", "prod");

    const buildAdapterPromise = createBunRouteAdapter({
      routesDir: activeConfig.routesDir,
      generatedMarkdownRootDir: path.resolve(activeConfig.cwd, ".rbssr/generated/markdown-routes"),
      projectionRootDir,
    });

    pendingAdapterCache.set(cacheKey, buildAdapterPromise);

    try {
      const adapter = await buildAdapterPromise;
      adapterCache.set(cacheKey, adapter);
      trimAdapterCache();
      return adapter;
    } finally {
      pendingAdapterCache.delete(cacheKey);
    }
  };

  const fetchHandler = async (request: Request): Promise<Response> => {
    await runtimeOptions.onBeforeRequest?.();

    const runtimePaths = runtimeOptions.resolvePaths?.() ?? {};
    const activeConfig: ResolvedConfig = {
      ...resolvedConfig,
      ...runtimePaths,
    };
    const devClientDir = path.resolve(resolvedConfig.cwd, ".rbssr/dev/client");

    const url = new URL(request.url);
    const finalize = (response: Response, kind: ResponseKind): Response => {
      return finalizeResponseHeaders({
        response,
        request,
        pathname: url.pathname,
        kind,
        dev,
        config: activeConfig,
      });
    };

    if (dev && url.pathname === "/__rbssr/events") {
      return finalize(createDevReloadEventStream({
        getVersion: () => runtimeOptions.reloadVersion?.() ?? 0,
        subscribe: runtimeOptions.subscribeReload,
      }), "internal-dev");
    }

    if (dev && url.pathname === "/__rbssr/version") {
      const version = runtimeOptions.reloadVersion?.() ?? 0;
      return finalize(new Response(String(version), {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
        },
      }), "internal-dev");
    }

    if (dev && url.pathname.startsWith("/__rbssr/client/")) {
      const relative = url.pathname.replace(/^\/__rbssr\/client\//, "");
      const response = await tryServeStatic(devClientDir, relative);
      if (response) {
        return finalize(response, "static");
      }
    }

    if (!dev && url.pathname.startsWith("/client/")) {
      const relative = url.pathname.replace(/^\/client\//, "");
      const response = await tryServeStatic(path.join(activeConfig.distDir, "client"), relative);
      if (response) {
        return finalize(response, "static");
      }
    }

    if (!dev) {
      const builtPublicResponse = await tryServeStatic(path.join(activeConfig.distDir, "client"), url.pathname);
      if (builtPublicResponse) {
        return finalize(builtPublicResponse, "static");
      }
    }

    const publicResponse = await tryServeStatic(activeConfig.publicDir, url.pathname);
    if (publicResponse) {
      return finalize(publicResponse, "static");
    }

    const routeAdapter = await getRouteAdapter(activeConfig);
    const cacheBustKey = dev ? String(runtimeOptions.reloadVersion?.() ?? Date.now()) : undefined;

    const apiMatch = routeAdapter.matchApi(url.pathname);
    if (apiMatch) {
      const apiModule = await loadApiRouteModule(apiMatch.route.filePath, cacheBustKey);
      const methodHandler = getMethodHandler(apiModule as Record<string, unknown>, request.method);

      if (typeof methodHandler !== "function") {
        const allow = getAllowedMethods(apiModule as Record<string, unknown>);
        return finalize(new Response("Method Not Allowed", {
          status: 405,
          headers: {
            allow: allow.join(", "),
          },
        }), "api");
      }

      const requestContext: RequestContext = {
        request,
        url,
        params: apiMatch.params,
        cookies: parseCookieHeader(request.headers.get("cookie")),
        locals: {},
      };

      const [globalMiddleware, routeMiddleware] = await Promise.all([
        loadGlobalMiddleware(activeConfig.middlewareFile, cacheBustKey),
        loadNestedMiddleware(apiMatch.route.middlewareFiles, cacheBustKey),
      ]);
      const allMiddleware = [...globalMiddleware, ...routeMiddleware];

      let response: Response;
      try {
        response = await runMiddlewareChain(allMiddleware, requestContext, async () => {
          const result = await (methodHandler as (ctx: RequestContext) => unknown)(requestContext);

          if (isResponse(result)) {
            return result;
          }

          if (isRedirectResult(result)) {
            return toRedirectResponse(result.location, result.status);
          }

          return json(result);
        });
      } catch (error) {
        return finalize(json(
          {
            error: sanitizeErrorMessage(error, !dev),
          },
          { status: 500 },
        ), "api");
      }
      return finalize(response, "api");
    }

    const pageMatch = routeAdapter.matchPage(url.pathname);

    if (!pageMatch) {
      const rootModule = await loadRootOnlyModule(activeConfig.rootModule, cacheBustKey);
      const fallbackRoute: RouteModule = {
        default: () => null,
        NotFound: rootModule.NotFound,
      };

      const payload = {
        routeId: "__not_found__",
        data: null,
        params: {},
        url: url.toString(),
      };

      const modules = {
        root: rootModule,
        layouts: [],
        route: fallbackRoute,
      };

      const markup = renderNotFoundApp(modules, payload) ?? "<main><h1>404</h1><p>Page not found.</p></main>";
      const head = collectHeadMarkup(modules, payload);

      const html = renderDocument({
        appMarkup: markup,
        payload,
        assets: {
          script: undefined,
          css: [],
          devVersion: dev ? runtimeOptions.reloadVersion?.() ?? 0 : undefined,
        },
        headMarkup: head,
      });

      return finalize(toHtmlResponse(html, 404), "html");
    }

    const [routeModules, globalMiddleware, nestedMiddleware] = await Promise.all([
      loadRouteModules({
        rootFilePath: activeConfig.rootModule,
        layoutFiles: pageMatch.route.layoutFiles,
        routeFilePath: pageMatch.route.filePath,
        cacheBustKey,
      }),
      loadGlobalMiddleware(activeConfig.middlewareFile, cacheBustKey),
      loadNestedMiddleware(pageMatch.route.middlewareFiles, cacheBustKey),
    ]);
    const moduleMiddleware = extractRouteMiddleware(routeModules.route);

    const requestContext: RequestContext = {
      request,
      url,
      params: pageMatch.params,
      cookies: parseCookieHeader(request.headers.get("cookie")),
      locals: {},
    };

    const routeAssets = resolveRouteAssets(pageMatch.route.id, {
      dev,
      runtimeOptions,
    });

    let response: Response;
    try {
      response = await runMiddlewareChain(
        [...globalMiddleware, ...nestedMiddleware, ...moduleMiddleware],
        requestContext,
        async () => {
          const method = request.method.toUpperCase();
          let data: unknown = null;

          if (isMutatingMethod(method)) {
            if (!routeModules.route.action) {
              return new Response("Method Not Allowed", { status: 405 });
            }

            const body = await parseActionBody(request.clone());
            const actionCtx: ActionContext = {
              ...requestContext,
              ...body,
            };

            const actionResult = await routeModules.route.action(actionCtx);

            if (isResponse(actionResult)) {
              return actionResult;
            }

            if (isRedirectResult(actionResult)) {
              return toRedirectResponse(actionResult.location, actionResult.status);
            }

            data = actionResult;
          } else {
            if (routeModules.route.loader) {
              const loaderCtx: LoaderContext = requestContext;
              const loaderResult = await routeModules.route.loader(loaderCtx);

              if (isResponse(loaderResult)) {
                return loaderResult;
              }

              if (isRedirectResult(loaderResult)) {
                return toRedirectResponse(loaderResult.location, loaderResult.status);
              }

              data = loaderResult;
            }
          }

          const payload = {
            routeId: pageMatch.route.id,
            data,
            params: pageMatch.params,
            url: url.toString(),
          };

          const headMarkup = collectHeadMarkup(routeModules, payload);

          let appMarkup: string;
          try {
            appMarkup = renderPageApp(routeModules, payload);
          } catch (error) {
            const boundaryMarkup = renderErrorApp(routeModules, payload, error);
            if (boundaryMarkup) {
              const errorPayload = {
                ...payload,
                error: {
                  message: sanitizeErrorMessage(error, !dev),
                },
              };
              const errorHead = collectHeadMarkup(routeModules, errorPayload);
              const html = renderDocument({
                appMarkup: boundaryMarkup,
                payload: errorPayload,
                assets: {
                  script: routeAssets?.script,
                  css: routeAssets?.css ?? [],
                  devVersion: dev ? runtimeOptions.reloadVersion?.() ?? 0 : undefined,
                },
                headMarkup: errorHead,
              });
              return toHtmlResponse(html, 500);
            }

            const message = sanitizeErrorMessage(error, !dev);
            return new Response(message, { status: 500 });
          }

          const html = renderDocument({
            appMarkup,
            payload,
            assets: {
              script: routeAssets?.script,
              css: routeAssets?.css ?? [],
              devVersion: dev ? runtimeOptions.reloadVersion?.() ?? 0 : undefined,
            },
            headMarkup,
          });

          return toHtmlResponse(html, 200);
        },
      );
    } catch (error) {
      const payload = {
        routeId: pageMatch.route.id,
        data: null,
        params: pageMatch.params,
        url: url.toString(),
      };
      const boundaryMarkup = renderErrorApp(routeModules, payload, error);
      if (boundaryMarkup) {
        const errorPayload = {
          ...payload,
          error: {
            message: sanitizeErrorMessage(error, !dev),
          },
        };
        const errorHead = collectHeadMarkup(routeModules, errorPayload);
        const html = renderDocument({
          appMarkup: boundaryMarkup,
          payload: errorPayload,
          assets: {
            script: routeAssets?.script,
            css: routeAssets?.css ?? [],
            devVersion: dev ? runtimeOptions.reloadVersion?.() ?? 0 : undefined,
          },
          headMarkup: errorHead,
        });
        return finalize(toHtmlResponse(html, 500), "html");
      }

      return finalize(new Response(sanitizeErrorMessage(error, !dev), { status: 500 }), "html");
    }

    return finalize(response, "html");
  };

  return {
    fetch: fetchHandler,
  };
}

export function startHttpServer(options: {
  config: FrameworkConfig;
  runtimeOptions?: ServerRuntimeOptions;
}): void {
  const server = createServer(options.config, options.runtimeOptions);
  const resolved = resolveConfig(options.config);

  const bunServer = Bun.serve({
    port: resolved.port,
    hostname: resolved.host,
    fetch: server.fetch,
    development: resolved.mode === "development",
  });

  // eslint-disable-next-line no-console
  console.log(`[react-bun-ssr] listening on ${bunServer.url}`);
}
