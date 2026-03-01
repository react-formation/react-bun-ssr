import type { ComponentType, ReactNode } from "react";

export type Params = Record<string, string>;

export interface RequestContext {
  request: Request;
  url: URL;
  params: Params;
  cookies: Map<string, string>;
  locals: Record<string, unknown>;
}

export interface LoaderContext extends RequestContext {}

export interface ActionContext extends RequestContext {
  formData?: FormData;
  json?: unknown;
}

export interface DeferredToken {
  __rbssrDeferred: string;
}

export interface DeferredLoaderResult<T extends Record<string, unknown> = Record<string, unknown>> {
  __rbssrType: "defer";
  data: T;
}

export type LoaderResult =
  | Response
  | RedirectResult
  | DeferredLoaderResult<Record<string, unknown>>
  | Record<string, unknown>
  | string
  | number
  | boolean
  | null;
export type ActionResult = LoaderResult | RedirectResult;

export type Loader = (ctx: LoaderContext) => Promise<LoaderResult> | LoaderResult;
export type Action = (ctx: ActionContext) => Promise<ActionResult> | ActionResult;

export interface RedirectResult {
  type: "redirect";
  location: string;
  status?: 301 | 302 | 303 | 307 | 308;
}

export type Middleware = (
  ctx: RequestContext,
  next: () => Promise<Response>,
) => Promise<Response> | Response;

export type HeadFn = (ctx: {
  data: unknown;
  params: Params;
  url: URL;
  error?: unknown;
}) => ReactNode;

export type MetaFn = (ctx: {
  data: unknown;
  params: Params;
  url: URL;
  error?: unknown;
}) => Record<string, string>;

export type MetaValue = Record<string, string> | MetaFn;

export interface RouteErrorResponse {
  type: "route_error";
  status: number;
  statusText: string;
  data?: unknown;
  headers?: Record<string, string>;
}

export type RouteErrorPhase = "loader" | "action" | "render" | "middleware" | "transition" | "api";

export interface RouteErrorContext {
  error: unknown;
  phase: RouteErrorPhase;
  routeId: string;
  request: Request;
  url: URL;
  params: Params;
  dev: boolean;
}

export interface RouteCatchContext extends Omit<RouteErrorContext, "error"> {
  error: RouteErrorResponse;
}

export interface RouteModule {
  default: ComponentType;
  Loading?: ComponentType;
  loader?: Loader;
  action?: Action;
  middleware?: Middleware | Middleware[];
  head?: HeadFn;
  meta?: MetaValue;
  ErrorComponent?: ComponentType<{ error: unknown; reset: () => void }>;
  CatchBoundary?: ComponentType<{ error: RouteErrorResponse; reset: () => void }>;
  onError?: (ctx: RouteErrorContext) => void | Promise<void>;
  onCatch?: (ctx: RouteCatchContext) => void | Promise<void>;
  ErrorBoundary?: ComponentType<{ error: unknown }>;
  NotFound?: ComponentType;
}

export type LayoutModule = RouteModule;

export type ApiHandler = (ctx: RequestContext) => Promise<Response | unknown> | Response | unknown;

export interface ApiRouteModule {
  GET?: ApiHandler;
  POST?: ApiHandler;
  PUT?: ApiHandler;
  PATCH?: ApiHandler;
  DELETE?: ApiHandler;
  HEAD?: ApiHandler;
  OPTIONS?: ApiHandler;
}

export interface ResponseHeaderRule {
  source: string;
  headers: Record<string, string>;
}

export interface ResolvedResponseHeaderRule extends ResponseHeaderRule {
  matcher: RegExp;
}

export interface FrameworkConfig {
  appDir?: string;
  routesDir?: string;
  publicDir?: string;
  rootModule?: string;
  middlewareFile?: string;
  distDir?: string;
  host?: string;
  port?: number;
  mode?: "development" | "production";
  serverBytecode?: boolean;
  headers?: ResponseHeaderRule[];
}

export interface ResolvedConfig {
  cwd: string;
  appDir: string;
  routesDir: string;
  publicDir: string;
  rootModule: string;
  middlewareFile: string;
  distDir: string;
  host: string;
  port: number;
  mode: "development" | "production";
  serverBytecode: boolean;
  headerRules: ResolvedResponseHeaderRule[];
}

export type SegmentKind = "static" | "dynamic" | "catchall";

export interface RouteSegment {
  kind: SegmentKind;
  value: string;
}

export interface PageRouteDefinition {
  type: "page";
  id: string;
  filePath: string;
  routePath: string;
  segments: RouteSegment[];
  score: number;
  layoutFiles: string[];
  middlewareFiles: string[];
  directory: string;
}

export interface ApiRouteDefinition {
  type: "api";
  id: string;
  filePath: string;
  routePath: string;
  segments: RouteSegment[];
  score: number;
  middlewareFiles: string[];
  directory: string;
}

export interface RouteManifest {
  pages: PageRouteDefinition[];
  api: ApiRouteDefinition[];
}

export interface RouteMatch<T extends PageRouteDefinition | ApiRouteDefinition> {
  route: T;
  params: Params;
}

export interface BuildRouteAsset {
  script: string;
  css: string[];
}

export interface BuildManifest {
  version: string;
  generatedAt: string;
  routes: Record<string, BuildRouteAsset>;
}

export interface RenderPayload {
  routeId: string;
  data: unknown;
  params: Params;
  url: string;
  error?: unknown;
}

export interface ClientRouteSnapshot {
  id: string;
  routePath: string;
  segments: RouteSegment[];
  score: number;
}

export interface ClientRouterSnapshot {
  pages: ClientRouteSnapshot[];
  assets: Record<string, BuildRouteAsset>;
  devVersion?: number;
}

export interface TransitionInitialChunk {
  type: "initial";
  kind: "page" | "not_found" | "catch" | "error";
  status: number;
  payload: RenderPayload;
  head: string;
  redirected: boolean;
}

export interface TransitionDeferredChunk {
  type: "deferred";
  id: string;
  ok: boolean;
  value?: unknown;
  error?: string;
}

export interface TransitionRedirectChunk {
  type: "redirect";
  location: string;
  status: number;
}

export type TransitionChunk = TransitionInitialChunk | TransitionDeferredChunk | TransitionRedirectChunk;

export interface RouteModuleBundle {
  root: RouteModule;
  layouts: LayoutModule[];
  route: RouteModule;
}

export interface HydrationDocumentAssets {
  script?: string;
  css: string[];
  devVersion?: number;
}

export interface ServerRuntimeOptions {
  dev?: boolean;
  buildManifest?: BuildManifest;
  devAssets?: Record<string, BuildRouteAsset>;
  getDevAssets?: () => Record<string, BuildRouteAsset>;
  reloadVersion?: () => number;
  subscribeReload?: (listener: (version: number) => void) => (() => void) | void;
  resolvePaths?: () => Partial<ResolvedConfig>;
  onBeforeRequest?: () => Promise<void>;
}
