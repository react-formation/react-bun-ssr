import type { AppRouteLocals as RootAppRouteLocals } from "react-bun-ssr";
import type {
  Action as RuntimeAction,
  ActionContext as RuntimeActionContext,
  ActionResult as RuntimeActionResult,
  DeferredLoaderResult as RuntimeDeferredLoaderResult,
  DeferredToken as RuntimeDeferredToken,
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
  RouteCatchContext as RuntimeRouteCatchContext,
  RouteErrorContext as RuntimeRouteErrorContext,
  RouteErrorResponse as RuntimeRouteErrorResponse,
} from "./types";

export interface AppRouteLocals extends RootAppRouteLocals, Record<string, unknown> {}

export type Action = RuntimeAction<AppRouteLocals>;
export type ActionContext = RuntimeActionContext<AppRouteLocals>;
export type ActionResult = RuntimeActionResult;
export type DeferredLoaderResult = RuntimeDeferredLoaderResult;
export type DeferredToken = RuntimeDeferredToken;
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
export type RouteCatchContext = RuntimeRouteCatchContext;
export type RouteErrorContext = RuntimeRouteErrorContext;
export type RouteErrorResponse = RuntimeRouteErrorResponse;

export { assertSameOriginAction, defer, json, redirect, sanitizeRedirectTarget } from "./helpers";
export { isRouteErrorResponse, notFound, routeError } from "./route-errors";
export { Link, type LinkProps } from "./link";
export { useRouter, type Router, type RouterNavigateInfo, type RouterNavigateListener, type RouterNavigateOptions } from "./router";
export {
  Outlet,
  createRouteAction,
  useLoaderData,
  useParams,
  useRequestUrl,
  useRouteAction,
  useRouteError,
} from "./tree";
