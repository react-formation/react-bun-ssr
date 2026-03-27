import type { ComponentType, ReactNode } from "react";

export type Params = Record<string, string>;

export interface AppRouteLocals extends Record<string, unknown> {}

export interface ResponseCookieOptions {
  path?: string;
  domain?: string;
  expires?: Date | string;
  maxAge?: number;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: "Strict" | "Lax" | "None" | "strict" | "lax" | "none";
}

export interface ResponseCookies {
  get(name: string): string | undefined;
  set(name: string, value: string, options?: ResponseCookieOptions): void;
  delete(name: string, options?: Omit<ResponseCookieOptions, "expires" | "maxAge">): void;
}

export interface ResponseContext {
  headers: Pick<Headers, "set" | "append" | "delete" | "get" | "has">;
  cookies: ResponseCookies;
}

export interface RequestContext<Locals extends Record<string, unknown> = AppRouteLocals> {
  request: Request;
  url: URL;
  params: Params;
  cookies: Map<string, string>;
  locals: Locals;
  response: ResponseContext;
}

export interface LoaderContext<Locals extends Record<string, unknown> = AppRouteLocals> extends RequestContext<Locals> {}

export interface ActionContext<Locals extends Record<string, unknown> = AppRouteLocals> extends RequestContext<Locals> {
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

export type Loader<Locals extends Record<string, unknown> = AppRouteLocals> = (
  ctx: LoaderContext<Locals>,
) => Promise<LoaderResult> | LoaderResult;
export type Action<Locals extends Record<string, unknown> = AppRouteLocals> = (
  ctx: ActionContext<Locals>,
) => Promise<ActionResult> | ActionResult;

export interface RedirectResult {
  type: "redirect";
  location: string;
  status?: 301 | 302 | 303 | 307 | 308;
}

export type Middleware<Locals extends Record<string, unknown> = AppRouteLocals> = (
  ctx: RequestContext<Locals>,
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

export type ApiHandler<Locals extends Record<string, unknown> = AppRouteLocals> = (
  ctx: RequestContext<Locals>,
) => Promise<Response | unknown> | Response | unknown;

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
  headers: Record<string, string | null>;
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
  serverFilePath?: string;
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
  loaderData: unknown;
  params: Params;
  url: string;
  error?: unknown;
}

export interface ActionDataEnvelope {
  type: "data";
  status: number;
  data: unknown;
}

export interface ActionRedirectEnvelope {
  type: "redirect";
  status: number;
  location: string;
}

export interface ActionCatchEnvelope {
  type: "catch";
  status: number;
  error: RouteErrorResponse;
}

export interface ActionErrorEnvelope {
  type: "error";
  status: number;
  message: string;
}

export type ActionResponseEnvelope =
  | ActionDataEnvelope
  | ActionRedirectEnvelope
  | ActionCatchEnvelope
  | ActionErrorEnvelope;

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

export interface TransitionDocumentChunk {
  type: "document";
  location: string;
  status: number;
}

export type TransitionChunk =
  | TransitionInitialChunk
  | TransitionDeferredChunk
  | TransitionRedirectChunk
  | TransitionDocumentChunk;

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
  routeManifestVersion?: () => number;
  subscribeReload?: (listener: (version: number) => void) => (() => void) | void;
  resolvePaths?: () => Partial<ResolvedConfig>;
  onBeforeRequest?: () => Promise<void>;
}
