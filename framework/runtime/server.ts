import path from "node:path";
import { createElement } from "react";
import { createBunRouteAdapter, type BunRouteAdapter } from "./bun-route-adapter";
import {
  isDeferredLoaderResult,
  prepareDeferredPayload,
  type DeferredSettleEntry,
} from "./deferred";
import { statPath } from "./io";
import type {
  ActionContext,
  BuildRouteAsset,
  ClientRouteSnapshot,
  ClientRouterSnapshot,
  FrameworkConfig,
  LoaderContext,
  PageRouteDefinition,
  RouteManifest,
  RequestContext,
  RouteCatchContext,
  RouteErrorContext,
  RouteErrorPhase,
  RouteErrorResponse,
  ResolvedConfig,
  RouteModule,
  RouteModuleBundle,
  ServerRuntimeOptions,
  TransitionChunk,
  TransitionDeferredChunk,
  TransitionInitialChunk,
  TransitionRedirectChunk,
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
  collectHeadElements,
  createManagedHeadMarkup,
  renderDocumentStream,
} from "./render";
import { runMiddlewareChain } from "./middleware";
import {
  createCatchAppTree,
  createErrorAppTree,
  createNotFoundAppTree,
  createPageAppTree,
} from "./tree";
import {
  sanitizeRouteErrorResponse,
  toRouteErrorHttpResponse,
  toRouteErrorResponse,
} from "./route-errors";
import {
  ensureWithin,
  isMutatingMethod,
  normalizeSlashes,
  parseCookieHeader,
  sanitizeErrorMessage,
  stableHash,
} from "./utils";

type ResponseKind = "static" | "html" | "api" | "internal-dev" | "internal-transition";

const HASHED_CLIENT_CHUNK_RE = /^\/client\/.+-[A-Za-z0-9]{6,}\.(?:js|css)$/;
const STATIC_IMMUTABLE_CACHE = "public, max-age=31536000, immutable";
const STATIC_DEFAULT_CACHE = "public, max-age=3600";

function toRedirectResponse(location: string, status = 302): Response {
  return Response.redirect(location, status);
}

function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

function resolveThrownRedirect(error: unknown): Response | null {
  if (!(error instanceof Response)) {
    return null;
  }

  const location = error.headers.get("location");
  if (location && isRedirectStatus(error.status)) {
    return Response.redirect(location, error.status);
  }

  return null;
}

function getLifecycleModules(modules: RouteModuleBundle): RouteModule[] {
  return [
    modules.route,
    ...[...modules.layouts].reverse(),
    modules.root,
  ];
}

function toRouteErrorContextBase(options: {
  requestContext: RequestContext;
  routeId: string;
  phase: RouteErrorPhase;
  dev: boolean;
}): Omit<RouteErrorContext, "error"> {
  return {
    request: options.requestContext.request,
    url: options.requestContext.url,
    params: options.requestContext.params,
    routeId: options.routeId,
    phase: options.phase,
    dev: options.dev,
  };
}

async function notifyErrorHooks(options: {
  modules: RouteModuleBundle;
  context: RouteErrorContext;
}): Promise<void> {
  const targets = getLifecycleModules(options.modules);
  for (const moduleValue of targets) {
    if (typeof moduleValue.onError !== "function") {
      continue;
    }

    try {
      await moduleValue.onError(options.context);
    } catch (hookError) {
      // eslint-disable-next-line no-console
      console.warn("[rbssr] route onError hook failed", Bun.inspect(hookError));
    }
  }
}

async function notifyCatchHooks(options: {
  modules: RouteModuleBundle;
  context: RouteCatchContext;
}): Promise<void> {
  const targets = getLifecycleModules(options.modules);
  for (const moduleValue of targets) {
    if (typeof moduleValue.onCatch !== "function") {
      continue;
    }

    try {
      await moduleValue.onCatch(options.context);
    } catch (hookError) {
      // eslint-disable-next-line no-console
      console.warn("[rbssr] route onCatch hook failed", Bun.inspect(hookError));
    }
  }
}

function toUncaughtErrorPayload(
  error: unknown,
  production: boolean,
): { message: string } {
  return {
    message: sanitizeErrorMessage(error, production),
  };
}

function toCaughtErrorPayload(
  routeErrorResponse: RouteErrorResponse,
  production: boolean,
): RouteErrorResponse {
  return sanitizeRouteErrorResponse(routeErrorResponse, production);
}

function toHtmlStreamResponse(stream: ReadableStream<Uint8Array>, status: number): Response {
  return new Response(stream, {
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

  if (kind === "internal-dev" || kind === "internal-transition") {
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
  options: {
    cacheBustKey?: string;
    serverBytecode: boolean;
  },
): Promise<RouteModule> {
  return loadRouteModule(rootModulePath, options);
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

function resolveAllRouteAssets(options: {
  dev: boolean;
  runtimeOptions: ServerRuntimeOptions;
}): Record<string, BuildRouteAsset> {
  if (options.dev) {
    return options.runtimeOptions.getDevAssets?.() ?? options.runtimeOptions.devAssets ?? {};
  }

  return options.runtimeOptions.buildManifest?.routes ?? {};
}

function toClientRouteSnapshots(routes: PageRouteDefinition[]): ClientRouteSnapshot[] {
  return routes.map(route => ({
    id: route.id,
    routePath: route.routePath,
    segments: route.segments,
    score: route.score,
  }));
}

function createRouterSnapshot(options: {
  manifest: RouteManifest;
  routeAssets: Record<string, BuildRouteAsset>;
  devVersion?: number;
}): ClientRouterSnapshot {
  return {
    pages: toClientRouteSnapshots(options.manifest.pages),
    assets: options.routeAssets,
    devVersion: options.devVersion,
  };
}

function toTransitionStreamResponse(
  stream: ReadableStream<Uint8Array>,
  baseHeaders?: HeadersInit,
): Response {
  const headers = new Headers(baseHeaders);
  headers.set("content-type", "application/x-ndjson; charset=utf-8");
  if (!headers.has("cache-control")) {
    headers.set("cache-control", "no-store");
  }

  return new Response(stream, {
    headers,
  });
}

function toTransitionChunkLine(chunk: TransitionChunk): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(chunk)}\n`);
}

function isRedirectStatus(status: number): boolean {
  return status >= 300 && status < 400;
}

function toRedirectChunk(location: string, status: number): TransitionRedirectChunk {
  return {
    type: "redirect",
    location,
    status,
  };
}

function createTransitionStream(options: {
  initialChunk?: TransitionInitialChunk;
  redirectChunk?: TransitionRedirectChunk;
  deferredSettleEntries?: DeferredSettleEntry[];
  sanitizeDeferredError: (message: string) => string;
}): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (options.redirectChunk) {
          controller.enqueue(toTransitionChunkLine(options.redirectChunk));
          controller.close();
          return;
        }

        if (options.initialChunk) {
          controller.enqueue(toTransitionChunkLine(options.initialChunk));
        }

        const settleEntries = options.deferredSettleEntries ?? [];
        if (settleEntries.length === 0) {
          controller.close();
          return;
        }

        await Promise.all(
          settleEntries.map(async entry => {
            const settled = await entry.settled;
            const chunk: TransitionDeferredChunk = settled.ok
              ? {
                  type: "deferred",
                  id: entry.id,
                  ok: true,
                  value: settled.value,
                }
              : {
                  type: "deferred",
                  id: entry.id,
                  ok: false,
                  error: options.sanitizeDeferredError(settled.error),
                };
            controller.enqueue(toTransitionChunkLine(chunk));
          }),
        );

        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
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
    const routesHash = stableHash(normalizeSlashes(activeConfig.routesDir));
    const projectionRootDir = dev
      ? path.resolve(activeConfig.cwd, ".rbssr/generated/router-projection", `dev-${routesHash}-v${reloadVersion}`)
      : path.resolve(activeConfig.cwd, ".rbssr/generated/router-projection", "prod", routesHash);

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
    const routeAssetsById = resolveAllRouteAssets({
      dev,
      runtimeOptions,
    });
    const routerSnapshot = createRouterSnapshot({
      manifest: routeAdapter.manifest,
      routeAssets: routeAssetsById,
      devVersion: dev ? runtimeOptions.reloadVersion?.() ?? 0 : undefined,
    });

    if (request.method.toUpperCase() === "GET" && url.pathname === "/__rbssr/transition") {
      const toParam = url.searchParams.get("to");
      if (!toParam) {
        return finalize(new Response("Missing required `to` query parameter.", { status: 400 }), "internal-transition");
      }

      let targetUrl: URL;
      try {
        targetUrl = new URL(toParam, url);
      } catch {
        return finalize(new Response("Invalid `to` URL.", { status: 400 }), "internal-transition");
      }

      if (targetUrl.origin !== url.origin) {
        return finalize(new Response("Cross-origin transitions are not allowed.", { status: 400 }), "internal-transition");
      }

      const transitionPageMatch = routeAdapter.matchPage(targetUrl.pathname);
      if (!transitionPageMatch) {
        const rootModule = await loadRootOnlyModule(activeConfig.rootModule, {
          cacheBustKey,
          serverBytecode: activeConfig.serverBytecode,
        });
        const fallbackRoute: RouteModule = {
          default: () => null,
          NotFound: rootModule.NotFound,
        };
        const payload = {
          routeId: "__not_found__",
          data: null,
          params: {},
          url: targetUrl.toString(),
        };
        const modules = {
          root: rootModule,
          layouts: [],
          route: fallbackRoute,
        };
        const initialChunk: TransitionInitialChunk = {
          type: "initial",
          kind: "not_found",
          status: 404,
          payload,
          head: createManagedHeadMarkup({
            headMarkup: collectHeadMarkup(modules, payload),
            assets: {
              script: undefined,
              css: [],
              devVersion: dev ? runtimeOptions.reloadVersion?.() ?? 0 : undefined,
            },
          }),
          redirected: false,
        };
        const stream = createTransitionStream({
          initialChunk,
          sanitizeDeferredError: message => sanitizeErrorMessage(message, !dev),
        });
        return finalize(toTransitionStreamResponse(stream), "internal-transition");
      }

      const [routeModules, globalMiddleware, nestedMiddleware] = await Promise.all([
        loadRouteModules({
          rootFilePath: activeConfig.rootModule,
          layoutFiles: transitionPageMatch.route.layoutFiles,
          routeFilePath: transitionPageMatch.route.filePath,
          cacheBustKey,
          serverBytecode: activeConfig.serverBytecode,
        }),
        loadGlobalMiddleware(activeConfig.middlewareFile, cacheBustKey),
        loadNestedMiddleware(transitionPageMatch.route.middlewareFiles, cacheBustKey),
      ]);
      const moduleMiddleware = extractRouteMiddleware(routeModules.route);
      const routeAssets = routeAssetsById[transitionPageMatch.route.id] ?? null;
      const transitionRequest = new Request(targetUrl.toString(), {
        method: "GET",
        headers: request.headers,
      });

      const requestContext: RequestContext = {
        request: transitionRequest,
        url: targetUrl,
        params: transitionPageMatch.params,
        cookies: parseCookieHeader(request.headers.get("cookie")),
        locals: {},
      };

      let transitionInitialChunk: TransitionInitialChunk | undefined;
      let deferredSettleEntries: DeferredSettleEntry[] = [];
      let transitionPhase: RouteErrorPhase = "middleware";

      let middlewareResponse: Response;
      try {
        middlewareResponse = await runMiddlewareChain(
          [...globalMiddleware, ...nestedMiddleware, ...moduleMiddleware],
          requestContext,
          async () => {
            let dataForRender: unknown = null;
            let dataForPayload: unknown = null;

            if (routeModules.route.loader) {
              transitionPhase = "loader";
              const loaderCtx: LoaderContext = requestContext;
              const loaderResult = await routeModules.route.loader(loaderCtx);

              if (isResponse(loaderResult)) {
                return loaderResult;
              }

              if (isRedirectResult(loaderResult)) {
                return toRedirectResponse(loaderResult.location, loaderResult.status);
              }

              if (isDeferredLoaderResult(loaderResult)) {
                const prepared = prepareDeferredPayload(transitionPageMatch.route.id, loaderResult);
                dataForRender = prepared.dataForRender;
                dataForPayload = prepared.dataForPayload;
                deferredSettleEntries = prepared.settleEntries;
              } else {
                dataForRender = loaderResult;
                dataForPayload = loaderResult;
              }
            }

            const renderPayload = {
              routeId: transitionPageMatch.route.id,
              data: dataForRender,
              params: transitionPageMatch.params,
              url: targetUrl.toString(),
            };
            const payload = {
              ...renderPayload,
              data: dataForPayload,
            };
            transitionInitialChunk = {
              type: "initial",
              kind: "page",
              status: 200,
              payload,
              head: createManagedHeadMarkup({
                headMarkup: collectHeadMarkup(routeModules, renderPayload),
                assets: {
                  script: routeAssets?.script,
                  css: routeAssets?.css ?? [],
                  devVersion: dev ? runtimeOptions.reloadVersion?.() ?? 0 : undefined,
                },
              }),
              redirected: false,
            };

            return new Response(null, { status: 204 });
          },
        );
      } catch (error) {
        const redirectResponse = resolveThrownRedirect(error);
        if (redirectResponse) {
          const location = redirectResponse.headers.get("location");
          if (location) {
            const stream = createTransitionStream({
              redirectChunk: toRedirectChunk(location, redirectResponse.status),
              sanitizeDeferredError: message => sanitizeErrorMessage(message, !dev),
            });
            return finalize(toTransitionStreamResponse(stream, redirectResponse.headers), "internal-transition");
          }
        }

        const contextBase = toRouteErrorContextBase({
          requestContext,
          routeId: transitionPageMatch.route.id,
          phase: transitionPhase,
          dev,
        });
        const caught = toRouteErrorResponse(error);
        if (caught) {
          const payload = {
            routeId: transitionPageMatch.route.id,
            data: null,
            params: transitionPageMatch.params,
            url: targetUrl.toString(),
            error: toCaughtErrorPayload(caught, !dev),
          };
          await notifyCatchHooks({
            modules: routeModules,
            context: {
              ...contextBase,
              error: caught,
            },
          });
          const initialChunk: TransitionInitialChunk = {
            type: "initial",
            kind: "catch",
            status: caught.status,
            payload,
            head: createManagedHeadMarkup({
              headMarkup: collectHeadMarkup(routeModules, payload),
              assets: {
                script: routeAssets?.script,
                css: routeAssets?.css ?? [],
                devVersion: dev ? runtimeOptions.reloadVersion?.() ?? 0 : undefined,
              },
            }),
            redirected: false,
          };
          const stream = createTransitionStream({
            initialChunk,
            sanitizeDeferredError: message => sanitizeErrorMessage(message, !dev),
          });
          return finalize(toTransitionStreamResponse(stream), "internal-transition");
        }

        await notifyErrorHooks({
          modules: routeModules,
          context: {
            ...contextBase,
            error,
          },
        });
        const renderPayload = {
          routeId: transitionPageMatch.route.id,
          data: null,
          params: transitionPageMatch.params,
          url: targetUrl.toString(),
          error: toUncaughtErrorPayload(error, !dev),
        };
        const initialChunk: TransitionInitialChunk = {
          type: "initial",
          kind: "error",
          status: 500,
          payload: renderPayload,
          head: createManagedHeadMarkup({
            headMarkup: collectHeadMarkup(routeModules, renderPayload),
            assets: {
              script: routeAssets?.script,
              css: routeAssets?.css ?? [],
              devVersion: dev ? runtimeOptions.reloadVersion?.() ?? 0 : undefined,
            },
          }),
          redirected: false,
        };
        const stream = createTransitionStream({
          initialChunk,
          sanitizeDeferredError: message => sanitizeErrorMessage(message, !dev),
        });
        return finalize(toTransitionStreamResponse(stream), "internal-transition");
      }

      const redirectLocation = middlewareResponse.headers.get("location");
      if (redirectLocation && isRedirectStatus(middlewareResponse.status)) {
        const stream = createTransitionStream({
          redirectChunk: toRedirectChunk(redirectLocation, middlewareResponse.status),
          sanitizeDeferredError: message => sanitizeErrorMessage(message, !dev),
        });
        return finalize(toTransitionStreamResponse(stream, middlewareResponse.headers), "internal-transition");
      }

      if (!transitionInitialChunk) {
        return finalize(
          new Response("Transition fallback required for non-streamable response.", { status: 409 }),
          "internal-transition",
        );
      }

      const stream = createTransitionStream({
        initialChunk: transitionInitialChunk,
        deferredSettleEntries,
        sanitizeDeferredError: message => sanitizeErrorMessage(message, !dev),
      });
      return finalize(toTransitionStreamResponse(stream, middlewareResponse.headers), "internal-transition");
    }

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
      let apiPhase: RouteErrorPhase = "middleware";

      let response: Response;
      try {
        response = await runMiddlewareChain(allMiddleware, requestContext, async () => {
          apiPhase = "api";
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
        const redirectResponse = resolveThrownRedirect(error);
        if (redirectResponse) {
          return finalize(redirectResponse, "api");
        }

        const caught = toRouteErrorResponse(error);
        if (caught) {
          return finalize(toRouteErrorHttpResponse(toCaughtErrorPayload(caught, !dev)), "api");
        }

        const apiErrorHook = (apiModule as Record<string, unknown>).onError;
        if (typeof apiErrorHook === "function") {
          try {
            await (apiErrorHook as (ctx: RouteErrorContext) => void | Promise<void>)({
              error,
              request: requestContext.request,
              url: requestContext.url,
              params: requestContext.params,
              routeId: apiMatch.route.id,
              phase: apiPhase,
              dev,
            });
          } catch (hookError) {
            // eslint-disable-next-line no-console
            console.warn("[rbssr] api onError hook failed", Bun.inspect(hookError));
          }
        }

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
      const rootModule = await loadRootOnlyModule(activeConfig.rootModule, {
        cacheBustKey,
        serverBytecode: activeConfig.serverBytecode,
      });
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

      const appTree = createNotFoundAppTree(modules, payload) ?? createElement(
        "main",
        null,
        createElement("h1", null, "404"),
        createElement("p", null, "Page not found."),
      );
      const stream = await renderDocumentStream({
        appTree,
        payload,
        assets: {
          script: undefined,
          css: [],
          devVersion: dev ? runtimeOptions.reloadVersion?.() ?? 0 : undefined,
        },
        headElements: collectHeadElements(modules, payload),
        routerSnapshot,
      });

      return finalize(toHtmlStreamResponse(stream, 404), "html");
    }

    const [routeModules, globalMiddleware, nestedMiddleware] = await Promise.all([
      loadRouteModules({
        rootFilePath: activeConfig.rootModule,
        layoutFiles: pageMatch.route.layoutFiles,
        routeFilePath: pageMatch.route.filePath,
        cacheBustKey,
        serverBytecode: activeConfig.serverBytecode,
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

    const routeAssets = routeAssetsById[pageMatch.route.id] ?? null;
    let pagePhase: RouteErrorPhase = "middleware";

    const renderFailureDocument = async (
      failure: unknown,
      phase: RouteErrorPhase,
    ): Promise<Response> => {
      const contextBase = toRouteErrorContextBase({
        requestContext,
        routeId: pageMatch.route.id,
        phase,
        dev,
      });
      const caught = toRouteErrorResponse(failure);
      if (caught) {
        const serializedCatch = toCaughtErrorPayload(caught, !dev);
        await notifyCatchHooks({
          modules: routeModules,
          context: {
            ...contextBase,
            error: caught,
          },
        });

        const basePayload = {
          routeId: pageMatch.route.id,
          data: null,
          params: pageMatch.params,
          url: url.toString(),
        };
        const catchPayload = {
          ...basePayload,
          error: serializedCatch,
        };

        if (serializedCatch.status === 404) {
          const notFoundTree = createNotFoundAppTree(routeModules, catchPayload);
          if (notFoundTree) {
            const stream = await renderDocumentStream({
              appTree: notFoundTree,
              payload: catchPayload,
              assets: {
                script: routeAssets?.script,
                css: routeAssets?.css ?? [],
                devVersion: dev ? runtimeOptions.reloadVersion?.() ?? 0 : undefined,
              },
              headElements: collectHeadElements(routeModules, catchPayload),
              routerSnapshot,
            });
            return toHtmlStreamResponse(stream, 404);
          }
        }

        const catchTree = createCatchAppTree(routeModules, catchPayload, serializedCatch);
        if (catchTree) {
          const stream = await renderDocumentStream({
            appTree: catchTree,
            payload: catchPayload,
            assets: {
              script: routeAssets?.script,
              css: routeAssets?.css ?? [],
              devVersion: dev ? runtimeOptions.reloadVersion?.() ?? 0 : undefined,
            },
            headElements: collectHeadElements(routeModules, catchPayload),
            routerSnapshot,
          });
          return toHtmlStreamResponse(stream, serializedCatch.status);
        }

        return toRouteErrorHttpResponse(serializedCatch);
      }

      await notifyErrorHooks({
        modules: routeModules,
        context: {
          ...contextBase,
          error: failure,
        },
      });

      const renderPayload = {
        routeId: pageMatch.route.id,
        data: null,
        params: pageMatch.params,
        url: url.toString(),
      };
      const errorPayload = {
        ...renderPayload,
        error: toUncaughtErrorPayload(failure, !dev),
      };
      const boundaryTree = createErrorAppTree(routeModules, errorPayload, failure);
      if (boundaryTree) {
        const stream = await renderDocumentStream({
          appTree: boundaryTree,
          payload: errorPayload,
          assets: {
            script: routeAssets?.script,
            css: routeAssets?.css ?? [],
            devVersion: dev ? runtimeOptions.reloadVersion?.() ?? 0 : undefined,
          },
          headElements: collectHeadElements(routeModules, errorPayload),
          routerSnapshot,
        });
        return toHtmlStreamResponse(stream, 500);
      }

      return new Response(sanitizeErrorMessage(failure, !dev), { status: 500 });
    };

    let response: Response;
    try {
      response = await runMiddlewareChain(
        [...globalMiddleware, ...nestedMiddleware, ...moduleMiddleware],
        requestContext,
        async () => {
          const method = request.method.toUpperCase();
          let dataForRender: unknown = null;
          let dataForPayload: unknown = null;
          let deferredSettleEntries: DeferredSettleEntry[] = [];

          if (isMutatingMethod(method)) {
            if (!routeModules.route.action) {
              return new Response("Method Not Allowed", { status: 405 });
            }

            pagePhase = "action";
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

            if (isDeferredLoaderResult(actionResult)) {
              return new Response("defer() is only supported in route loaders", { status: 500 });
            }

            dataForRender = actionResult;
            dataForPayload = actionResult;
          } else {
            if (routeModules.route.loader) {
              pagePhase = "loader";
              const loaderCtx: LoaderContext = requestContext;
              const loaderResult = await routeModules.route.loader(loaderCtx);

              if (isResponse(loaderResult)) {
                return loaderResult;
              }

              if (isRedirectResult(loaderResult)) {
                return toRedirectResponse(loaderResult.location, loaderResult.status);
              }

              if (isDeferredLoaderResult(loaderResult)) {
                const prepared = prepareDeferredPayload(pageMatch.route.id, loaderResult);
                dataForRender = prepared.dataForRender;
                dataForPayload = prepared.dataForPayload;
                deferredSettleEntries = prepared.settleEntries;
              } else {
                dataForRender = loaderResult;
                dataForPayload = loaderResult;
              }
            }
          }

          const renderPayload = {
            routeId: pageMatch.route.id,
            data: dataForRender,
            params: pageMatch.params,
            url: url.toString(),
          };

          const clientPayload = {
            ...renderPayload,
            data: dataForPayload,
          };

          let appTree: ReturnType<typeof createPageAppTree>;
          try {
            pagePhase = "render";
            appTree = createPageAppTree(routeModules, renderPayload);
          } catch (error) {
            const fallbackResponse = await renderFailureDocument(error, pagePhase);
            return fallbackResponse;
          }

          const stream = await renderDocumentStream({
            appTree,
            payload: clientPayload,
            assets: {
              script: routeAssets?.script,
              css: routeAssets?.css ?? [],
              devVersion: dev ? runtimeOptions.reloadVersion?.() ?? 0 : undefined,
            },
            headElements: collectHeadElements(routeModules, renderPayload),
            routerSnapshot,
            deferredSettleEntries,
          });

          return toHtmlStreamResponse(stream, 200);
        },
      );
    } catch (error) {
      const redirectResponse = resolveThrownRedirect(error);
      if (redirectResponse) {
        return finalize(redirectResponse, "html");
      }

      const fallbackResponse = await renderFailureDocument(error, pagePhase);
      return finalize(fallbackResponse, "html");
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
