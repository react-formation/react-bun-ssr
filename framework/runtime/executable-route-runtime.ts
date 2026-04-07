import {
  extractRouteMiddleware,
  loadApiRouteModule,
  loadGlobalMiddleware,
  loadNestedMiddleware,
  loadRouteModules,
  type RouteModuleLoadOptions,
} from "./module-loader";
import { createResponseContext } from "./response-context";
import type {
  ApiRouteDefinition,
  ApiRouteModule,
  Middleware,
  PageRouteDefinition,
  RequestContext,
  RouteMatch,
  RouteModuleBundle,
} from "./types";
import { parseCookieHeader } from "./utils";

export interface ExecutablePageRoute {
  match: RouteMatch<PageRouteDefinition>;
  modules: RouteModuleBundle;
  middleware: Middleware[];
  requestContext: RequestContext;
}

export interface ExecutableApiRoute {
  match: RouteMatch<ApiRouteDefinition>;
  module: ApiRouteModule;
  middleware: Middleware[];
  requestContext: RequestContext;
}

export interface ExecutableRouteRuntimeDeps {
  loadRouteBundle(options: {
    rootFilePath: string;
    layoutFiles: string[];
    routeFilePath: string;
    routeServerFilePath?: string;
    cacheBustKey?: string;
    serverBytecode?: boolean;
    devSourceImports?: boolean;
    nodeEnv?: "development" | "production";
  }): Promise<RouteModuleBundle>;
  loadApiModule(filePath: string, options: RouteModuleLoadOptions): Promise<ApiRouteModule>;
  loadGlobalMiddleware(
    filePath: string,
    options: RouteModuleLoadOptions | string,
  ): Promise<Middleware[]>;
  loadNestedMiddleware(
    filePaths: string[],
    options: RouteModuleLoadOptions | string,
  ): Promise<Middleware[]>;
}

export interface ExecutableRouteRuntime {
  preparePageRoute(input: {
    match: RouteMatch<PageRouteDefinition>;
    request: Request;
    url: URL;
    routeLoadOptions: RouteModuleLoadOptions;
    middlewareLoadOptions: RouteModuleLoadOptions;
  }): Promise<ExecutablePageRoute>;
  prepareApiRoute(input: {
    match: RouteMatch<ApiRouteDefinition>;
    request: Request;
    url: URL;
    loadOptions: RouteModuleLoadOptions;
  }): Promise<ExecutableApiRoute>;
}

function createRequestContext(options: {
  request: Request;
  url: URL;
  params: RequestContext["params"];
}): RequestContext {
  const cookies = parseCookieHeader(options.request.headers.get("cookie"));
  return {
    request: options.request,
    url: options.url,
    params: options.params,
    cookies,
    locals: {},
    response: createResponseContext(cookies),
  };
}

export function createExecutableRouteRuntime(options: {
  rootFilePath: string;
  globalMiddlewareFilePath: string;
  deps?: Partial<ExecutableRouteRuntimeDeps>;
}): ExecutableRouteRuntime {
  const deps: ExecutableRouteRuntimeDeps = {
    loadRouteBundle: loadRouteModules,
    loadApiModule: loadApiRouteModule,
    loadGlobalMiddleware,
    loadNestedMiddleware,
    ...options.deps,
  };

  return {
    async preparePageRoute(input) {
      const [modules, globalMiddleware, nestedMiddleware] = await Promise.all([
        deps.loadRouteBundle({
          rootFilePath: options.rootFilePath,
          layoutFiles: input.match.route.layoutFiles,
          routeFilePath: input.match.route.filePath,
          routeServerFilePath: input.match.route.serverFilePath,
          ...input.routeLoadOptions,
        }),
        deps.loadGlobalMiddleware(options.globalMiddlewareFilePath, input.middlewareLoadOptions),
        deps.loadNestedMiddleware(input.match.route.middlewareFiles, input.middlewareLoadOptions),
      ]);

      return {
        match: input.match,
        modules,
        middleware: [
          ...globalMiddleware,
          ...nestedMiddleware,
          ...extractRouteMiddleware(modules.route),
        ],
        requestContext: createRequestContext({
          request: input.request,
          url: input.url,
          params: input.match.params,
        }),
      };
    },

    async prepareApiRoute(input) {
      const [module, globalMiddleware, nestedMiddleware] = await Promise.all([
        deps.loadApiModule(input.match.route.filePath, input.loadOptions),
        deps.loadGlobalMiddleware(options.globalMiddlewareFilePath, input.loadOptions),
        deps.loadNestedMiddleware(input.match.route.middlewareFiles, input.loadOptions),
      ]);

      return {
        match: input.match,
        module,
        middleware: [
          ...globalMiddleware,
          ...nestedMiddleware,
        ],
        requestContext: createRequestContext({
          request: input.request,
          url: input.url,
          params: input.match.params,
        }),
      };
    },
  };
}
