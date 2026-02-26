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

export interface RouteModule {
  default: ComponentType;
  loader?: Loader;
  action?: Action;
  middleware?: Middleware | Middleware[];
  head?: HeadFn;
  meta?: MetaValue;
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
  error?: {
    message: string;
  };
}

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
