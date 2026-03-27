import type {
  Action as RuntimeAction,
  ActionContext as RuntimeActionContext,
  ActionResult as RuntimeActionResult,
  ApiRouteModule as RuntimeApiRouteModule,
  BuildManifest as RuntimeBuildManifest,
  BuildRouteAsset as RuntimeBuildRouteAsset,
  DeferredLoaderResult as RuntimeDeferredLoaderResult,
  DeferredToken as RuntimeDeferredToken,
  FrameworkConfig as RuntimeFrameworkConfig,
  Loader as RuntimeLoader,
  LoaderContext as RuntimeLoaderContext,
  LoaderResult as RuntimeLoaderResult,
  Middleware as RuntimeMiddleware,
  Params as RuntimeParams,
  RedirectResult as RuntimeRedirectResult,
  RequestContext as RuntimeRequestContext,
  ResponseContext as RuntimeResponseContext,
  ResponseCookies as RuntimeResponseCookies,
  ResponseCookieOptions as RuntimeResponseCookieOptions,
  ResponseHeaderRule as RuntimeResponseHeaderRule,
  RouteCatchContext as RuntimeRouteCatchContext,
  RouteErrorContext as RuntimeRouteErrorContext,
  RouteErrorResponse as RuntimeRouteErrorResponse,
  RouteModule as RuntimeRouteModule,
} from "./types";

export interface AppRouteLocals extends Record<string, unknown> {}

export type Action = RuntimeAction<AppRouteLocals>;
export type ActionContext = RuntimeActionContext<AppRouteLocals>;
export type ActionResult = RuntimeActionResult;
export type ApiRouteModule = RuntimeApiRouteModule;
export type BuildManifest = RuntimeBuildManifest;
export type BuildRouteAsset = RuntimeBuildRouteAsset;
export type DeferredLoaderResult = RuntimeDeferredLoaderResult;
export type DeferredToken = RuntimeDeferredToken;
export type FrameworkConfig = RuntimeFrameworkConfig;
export type Loader = RuntimeLoader<AppRouteLocals>;
export type LoaderContext = RuntimeLoaderContext<AppRouteLocals>;
export type LoaderResult = RuntimeLoaderResult;
export type Middleware = RuntimeMiddleware<AppRouteLocals>;
export type Params = RuntimeParams;
export type RedirectResult = RuntimeRedirectResult;
export type RequestContext = RuntimeRequestContext<AppRouteLocals>;
export type ResponseContext = RuntimeResponseContext;
export type ResponseCookies = RuntimeResponseCookies;
export type ResponseCookieOptions = RuntimeResponseCookieOptions;
export type ResponseHeaderRule = RuntimeResponseHeaderRule;
export type RouteCatchContext = RuntimeRouteCatchContext;
export type RouteErrorContext = RuntimeRouteErrorContext;
export type RouteErrorResponse = RuntimeRouteErrorResponse;
export type RouteModule = RuntimeRouteModule;

export { createServer, startHttpServer } from "./server";
export { assertSameOriginAction, defer, defineConfig, json, redirect, sanitizeRedirectTarget } from "./helpers";
export { isRouteErrorResponse, notFound, routeError } from "./route-errors";
export { Link, type LinkProps } from "./link";
export { useRouter, type Router, type RouterNavigateInfo, type RouterNavigateListener, type RouterNavigateOptions } from "./router";
export { Outlet, useLoaderData, useParams, useRequestUrl, useRouteError } from "./tree";
