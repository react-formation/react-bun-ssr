import fs from "node:fs";
import path from "node:path";
import type {
  ActionContext,
  BuildRouteAsset,
  FrameworkConfig,
  LoaderContext,
  RequestContext,
  ResolvedConfig,
  RouteManifest,
  RouteModule,
  ServerRuntimeOptions,
} from "./types";
import { resolveConfig } from "./config";
import { isRedirectResult, json } from "./helpers";
import { matchApiRoute, matchPageRoute } from "./matcher";
import {
  extractRouteMiddleware,
  importModule,
  loadApiRouteModule,
  loadGlobalMiddleware,
  loadNestedMiddleware,
  loadRouteModules,
} from "./module-loader";
import {
  collectHeadMarkup,
  renderDocument,
  renderErrorApp,
  renderNotFoundApp,
  renderPageApp,
} from "./render";
import { scanRoutes } from "./route-scanner";
import { runMiddlewareChain } from "./middleware";
import {
  ensureWithin,
  isMutatingMethod,
  parseCookieHeader,
  sanitizeErrorMessage,
} from "./utils";

function toRedirectResponse(location: string, status = 302): Response {
  return Response.redirect(location, status);
}

function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

function toHeadResponse(response: Response): Response {
  return new Response(null, {
    status: response.status,
    headers: response.headers,
  });
}

function toHtmlResponse(html: string, status: number, method: string): Response {
  const response = new Response(method === "HEAD" ? null : html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });

  if (method === "HEAD") {
    return toHeadResponse(response);
  }

  return response;
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
  if (!resolved || !fs.existsSync(resolved)) {
    return null;
  }

  const stat = fs.statSync(resolved);
  if (!stat.isFile()) {
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
  const moduleValue = await importModule<Partial<RouteModule>>(rootModulePath, cacheBustKey);
  if (typeof moduleValue.default !== "function") {
    throw new Error(`Root module ${rootModulePath} must export a default React component`);
  }

  return {
    ...moduleValue,
    default: moduleValue.default,
  } as RouteModule;
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
          cleanup();
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
  const devClientDir = path.resolve(resolvedConfig.cwd, ".rbssr/dev/client");

  let cachedManifest: RouteManifest | null = null;

  const getManifest = (): RouteManifest => {
    if (!cachedManifest || dev) {
      cachedManifest = scanRoutes(resolvedConfig.routesDir);
    }
    return cachedManifest;
  };

  const fetchHandler = async (request: Request): Promise<Response> => {
    await runtimeOptions.onBeforeRequest?.();

    const url = new URL(request.url);

    if (dev && url.pathname === "/__rbssr/events") {
      return createDevReloadEventStream({
        getVersion: () => runtimeOptions.reloadVersion?.() ?? 0,
        subscribe: runtimeOptions.subscribeReload,
      });
    }

    if (dev && url.pathname === "/__rbssr/version") {
      const version = runtimeOptions.reloadVersion?.() ?? 0;
      return new Response(String(version), {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    if (dev && url.pathname.startsWith("/__rbssr/client/")) {
      const relative = url.pathname.replace(/^\/__rbssr\/client\//, "");
      const response = await tryServeStatic(devClientDir, relative);
      if (response) {
        return response;
      }
    }

    if (!dev && url.pathname.startsWith("/client/")) {
      const relative = url.pathname.replace(/^\/client\//, "");
      const response = await tryServeStatic(path.join(resolvedConfig.distDir, "client"), relative);
      if (response) {
        return response;
      }
    }

    if (!dev) {
      const builtPublicResponse = await tryServeStatic(path.join(resolvedConfig.distDir, "client"), url.pathname);
      if (builtPublicResponse) {
        return builtPublicResponse;
      }
    }

    const publicResponse = await tryServeStatic(resolvedConfig.publicDir, url.pathname);
    if (publicResponse) {
      return publicResponse;
    }

    const manifest = getManifest();
    const cacheBustKey = dev ? String(runtimeOptions.reloadVersion?.() ?? Date.now()) : undefined;

    const apiMatch = matchApiRoute(manifest.api, url.pathname);
    if (apiMatch) {
      const apiModule = await loadApiRouteModule(apiMatch.route.filePath, cacheBustKey);
      const methodHandler = getMethodHandler(apiModule as Record<string, unknown>, request.method);

      if (typeof methodHandler !== "function") {
        const allow = getAllowedMethods(apiModule as Record<string, unknown>);
        return new Response("Method Not Allowed", {
          status: 405,
          headers: {
            allow: allow.join(", "),
          },
        });
      }

      const requestContext: RequestContext = {
        request,
        url,
        params: apiMatch.params,
        cookies: parseCookieHeader(request.headers.get("cookie")),
        locals: {},
      };

      const globalMiddleware = await loadGlobalMiddleware(resolvedConfig.middlewareFile, cacheBustKey);
      const routeMiddleware = await loadNestedMiddleware(apiMatch.route.middlewareFiles, cacheBustKey);
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
        return json(
          {
            error: sanitizeErrorMessage(error, !dev),
          },
          { status: 500 },
        );
      }

      if (request.method.toUpperCase() === "HEAD") {
        return toHeadResponse(response);
      }

      return response;
    }

    const pageMatch = matchPageRoute(manifest.pages, url.pathname);

    if (!pageMatch) {
      const rootModule = await loadRootOnlyModule(resolvedConfig.rootModule, cacheBustKey);
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

      return toHtmlResponse(html, 404, request.method.toUpperCase());
    }

    const routeModules = await loadRouteModules({
      rootFilePath: resolvedConfig.rootModule,
      layoutFiles: pageMatch.route.layoutFiles,
      routeFilePath: pageMatch.route.filePath,
      cacheBustKey,
    });

    const globalMiddleware = await loadGlobalMiddleware(resolvedConfig.middlewareFile, cacheBustKey);
    const nestedMiddleware = await loadNestedMiddleware(pageMatch.route.middlewareFiles, cacheBustKey);
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
              return toHtmlResponse(html, 500, method);
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

          return toHtmlResponse(html, 200, method);
        },
      );
    } catch (error) {
      const method = request.method.toUpperCase();
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
        return toHtmlResponse(html, 500, method);
      }

      return new Response(sanitizeErrorMessage(error, !dev), { status: 500 });
    }

    if (request.method.toUpperCase() === "HEAD") {
      return toHeadResponse(response);
    }

    return response;
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
