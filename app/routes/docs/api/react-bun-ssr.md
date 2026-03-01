---
title: react-bun-ssr
navTitle: react-bun-ssr
description: Public runtime exports from the root package entrypoint.
section: API
order: 3
kind: api
tags: api,generated
---

# react-bun-ssr

Auto-generated from framework TypeScript exports. Do not edit manually.

Import from `react-bun-ssr` for runtime startup APIs, config helpers, response helpers, and deployment-facing types. Start here when you are wiring Bun server startup or authoring `rbssr.config.ts`.

## Examples

### Typed config with response headers

```tsx
import { defineConfig } from "react-bun-ssr";

export default defineConfig({
  port: 3000,
  headers: [
    {
      source: "/api/**",
      headers: {
        "x-frame-options": "DENY",
      },
    },
  ],
});
```

### Runtime JSON and redirect helpers

```tsx
import { json, redirect } from "react-bun-ssr";

export function GET() {
  return json({ ok: true });
}

export function POST() {
  return redirect("/docs/data/actions");
}
```

## Exported symbols

## Action

- Kind: type
- Source: `framework/runtime/types.ts`
- Description: Route action function signature for handling mutating HTTP requests.
- Learn more: [Actions](/docs/data/actions)

```ts
export type Action = (ctx: ActionContext) => Promise<ActionResult> | ActionResult;
```

## ActionContext

- Kind: interface
- Source: `framework/runtime/types.ts`
- Description: Context object passed to actions with request metadata, parsed body helpers, and framework-normalized cookies exposed as `Map<string, string>` rather than Bun's `CookieMap`.
- Learn more: [Actions](/docs/data/actions), [Bun Runtime APIs](/docs/api/bun-runtime-apis), [Cookies](https://bun.com/docs/api/cookie), [HTTP server cookies](https://bun.com/docs/runtime/http/cookies)

```ts
export interface ActionContext extends RequestContext {
  formData?: FormData;
  json?: unknown;
}
```

## ActionResult

- Kind: type
- Source: `framework/runtime/types.ts`
- Description: Allowed return union for actions, including data, redirects, and `Response` values.
- Learn more: [Actions](/docs/data/actions)

```ts
export type ActionResult = LoaderResult | RedirectResult;
```

## ApiRouteModule

- Kind: interface
- Source: `framework/runtime/types.ts`
- Description: Contract for API route modules exporting method handlers like `GET` and `POST`.
- Learn more: [File-Based Routing](/docs/routing/file-based-routing)

```ts
export interface ApiRouteModule {
  GET?: ApiHandler;
  POST?: ApiHandler;
  PUT?: ApiHandler;
  PATCH?: ApiHandler;
  DELETE?: ApiHandler;
  HEAD?: ApiHandler;
  OPTIONS?: ApiHandler;
}
```

## BuildManifest

- Kind: interface
- Source: `framework/runtime/types.ts`
- Description: Production manifest describing built route assets used for SSR document injection.
- Learn more: [Build Output](/docs/tooling/build-output)

```ts
export interface BuildManifest {
  version: string;
  generatedAt: string;
  routes: Record<string, BuildRouteAsset>;
}
```

## BuildRouteAsset

- Kind: interface
- Source: `framework/runtime/types.ts`
- Description: Per-route client asset metadata (entry script and CSS files).
- Learn more: [Build Output](/docs/tooling/build-output)

```ts
export interface BuildRouteAsset {
  script: string;
  css: string[];
}
```

## createServer

- Kind: function
- Source: `framework/runtime/server.ts`
- Description: Creates the runtime request handler used by Bun server entrypoints.
- Learn more: [Bun Runtime APIs](/docs/api/bun-runtime-apis), [Bun-only deployment](/docs/deployment/bun-deployment), [SSR and hydration](/docs/rendering/ssr-hydration), [Bun APIs](https://bun.com/docs/runtime/bun-apis), [Common HTTP server usage](https://bun.com/docs/guides/http/server)

```ts
createServer(config?: FrameworkConfig, runtimeOptions?: ServerRuntimeOptions): { fetch(req: Request): Promise<Response>; }
```

## defer

- Kind: variable
- Source: `framework/runtime/helpers.ts`
- Description: Marks loader return data as deferred so promise-backed keys can stream progressively.
- Learn more: [Loaders](/docs/data/loaders), [Streaming and Deferred](/docs/rendering/streaming-deferred)

```ts
defer<T extends Record<string, unknown>>(data: T): DeferredLoaderResult<T>
```

## DeferredLoaderResult

- Kind: interface
- Source: `framework/runtime/types.ts`
- Description: Typed wrapper returned by `defer()` for loaders with immediate and deferred values.
- Learn more: [Loaders](/docs/data/loaders)

```ts
export interface DeferredLoaderResult<T extends Record<string, unknown> = Record<string, unknown>> {
  __rbssrType: "defer";
  data: T;
}
```

## DeferredToken

- Kind: interface
- Source: `framework/runtime/types.ts`
- Description: Serialized payload token used internally to revive deferred values during hydration.
- Learn more: [Streaming and Deferred](/docs/rendering/streaming-deferred)

```ts
export interface DeferredToken {
  __rbssrDeferred: string;
}
```

## defineConfig

- Kind: function
- Source: `framework/runtime/helpers.ts`
- Description: Helper for authoring typed `rbssr.config.ts` configuration.
- Learn more: [Configuration](/docs/deployment/configuration)

```ts
defineConfig(config: FrameworkConfig): FrameworkConfig
```

## FrameworkConfig

- Kind: interface
- Source: `framework/runtime/types.ts`
- Description: Main framework configuration surface for paths, server mode, response headers, and server bytecode behavior.
- Learn more: [Configuration](/docs/deployment/configuration)

```ts
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
```

## isRouteErrorResponse

- Kind: function
- Source: `framework/runtime/route-errors.ts`
- Description: Type guard for narrowing unknown errors to framework caught route errors.
- Learn more: [Error Handling](/docs/data/error-handling)

```ts
isRouteErrorResponse(value: unknown): value is RouteErrorResponse
```

## json

- Kind: function
- Source: `framework/runtime/helpers.ts`
- Description: Creates a JSON `Response` with a default UTF-8 content-type.
- Learn more: [API Overview](/docs/api/overview)

```ts
json(data: unknown, init?: ResponseInit): Response
```

## Link

- Kind: function
- Source: `framework/runtime/link.tsx`

```ts
Link(props: LinkProps): Element
```

## LinkProps

- Kind: interface
- Source: `framework/runtime/link.tsx`

```ts
export interface LinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  to: string;
  replace?: boolean;
  scroll?: boolean;
  prefetch?: "intent" | "none";
  onNavigate?: (info: NavigateInfo) => void;
}
```

## Loader

- Kind: type
- Source: `framework/runtime/types.ts`
- Description: Route loader function signature for GET/HEAD data requests.
- Learn more: [Loaders](/docs/data/loaders)

```ts
export type Loader = (ctx: LoaderContext) => Promise<LoaderResult> | LoaderResult;
```

## LoaderContext

- Kind: interface
- Source: `framework/runtime/types.ts`
- Description: Context object passed to loaders with URL, params, mutable locals, and framework-normalized cookies exposed as `Map<string, string>` rather than Bun's `CookieMap`.
- Learn more: [Loaders](/docs/data/loaders), [Bun Runtime APIs](/docs/api/bun-runtime-apis), [Cookies](https://bun.com/docs/api/cookie), [HTTP server cookies](https://bun.com/docs/runtime/http/cookies)

```ts
export interface LoaderContext extends RequestContext {}
```

## LoaderResult

- Kind: type
- Source: `framework/runtime/types.ts`
- Description: Allowed return union for loaders, including plain data, redirects, deferred data, and `Response`.
- Learn more: [Loaders](/docs/data/loaders)

```ts
export type LoaderResult =
  | Response
  | RedirectResult
  | DeferredLoaderResult<Record<string, unknown>>
  | Record<string, unknown>
  | string
  | number
  | boolean
  | null;
```

## Middleware

- Kind: type
- Source: `framework/runtime/types.ts`
- Description: Middleware function contract executed around page and API handlers.
- Learn more: [Layouts and Groups](/docs/routing/layouts-and-groups)

```ts
export type Middleware = (
  ctx: RequestContext,
  next: () => Promise<Response>,
) => Promise<Response> | Response;
```

## notFound

- Kind: function
- Source: `framework/runtime/route-errors.ts`
- Description: Throws a typed caught 404 route error for nearest not-found/catch boundary handling.
- Learn more: [Error Handling](/docs/data/error-handling)

```ts
notFound(data?: unknown): never
```

## Outlet

- Kind: function
- Source: `framework/runtime/tree.tsx`
- Description: Renders the next nested route element inside root/layout route modules.
- Learn more: [Layouts and Groups](/docs/routing/layouts-and-groups)

```ts
Outlet(): ReactElement<unknown, string | JSXElementConstructor<any>> | null
```

## Params

- Kind: type
- Source: `framework/runtime/types.ts`
- Description: Dynamic URL params object shape exposed to loaders, actions, and hooks.
- Learn more: [File-Based Routing](/docs/routing/file-based-routing)

```ts
export type Params = Record<string, string>;
```

## redirect

- Kind: function
- Source: `framework/runtime/helpers.ts`
- Description: Returns a framework redirect descriptor consumed by loader/action runtime flow.
- Learn more: [Actions](/docs/data/actions)

```ts
redirect(location: string, status?: 301 | 302 | 303 | 307 | 308 | undefined): RedirectResult
```

## RedirectResult

- Kind: interface
- Source: `framework/runtime/types.ts`
- Description: Redirect descriptor shape with destination and HTTP redirect status.
- Learn more: [Actions](/docs/data/actions)

```ts
export interface RedirectResult {
  type: "redirect";
  location: string;
  status?: 301 | 302 | 303 | 307 | 308;
}
```

## RequestContext

- Kind: interface
- Source: `framework/runtime/types.ts`
- Description: Base request context shared by middleware, loaders, actions, and API handlers, including framework-normalized cookies as `Map<string, string>` rather than Bun's `CookieMap`.
- Learn more: [Layouts and Groups](/docs/routing/layouts-and-groups), [Bun Runtime APIs](/docs/api/bun-runtime-apis), [Cookies](https://bun.com/docs/api/cookie), [HTTP server cookies](https://bun.com/docs/runtime/http/cookies)

```ts
export interface RequestContext {
  request: Request;
  url: URL;
  params: Params;
  cookies: Map<string, string>;
  locals: Record<string, unknown>;
}
```

## ResponseHeaderRule

- Kind: interface
- Source: `framework/runtime/types.ts`
- Description: Path-based response header rule used by `FrameworkConfig.headers`.
- Learn more: [Configuration](/docs/deployment/configuration)

```ts
export interface ResponseHeaderRule {
  source: string;
  headers: Record<string, string>;
}
```

## RouteCatchContext

- Kind: interface
- Source: `framework/runtime/types.ts`
- Description: Context passed to `onCatch` lifecycle hooks when a typed caught route error is handled.
- Learn more: [Error Handling](/docs/data/error-handling)

```ts
export interface RouteCatchContext extends Omit<RouteErrorContext, "error"> {
  error: RouteErrorResponse;
}
```

## routeError

- Kind: function
- Source: `framework/runtime/route-errors.ts`
- Description: Throws a typed caught route error with status/data for TanStack-style catch-boundary flows.
- Learn more: [Error Handling](/docs/data/error-handling)

```ts
routeError(status: number, data?: unknown, init?: { statusText?: string | undefined; headers?: HeadersInit | undefined; }): never
```

## RouteErrorContext

- Kind: interface
- Source: `framework/runtime/types.ts`
- Description: Context passed to `onError` lifecycle hooks for uncaught route failures.
- Learn more: [Error Handling](/docs/data/error-handling)

```ts
export interface RouteErrorContext {
  error: unknown;
  phase: RouteErrorPhase;
  routeId: string;
  request: Request;
  url: URL;
  params: Params;
  dev: boolean;
}
```

## RouteErrorResponse

- Kind: interface
- Source: `framework/runtime/types.ts`
- Description: Serializable caught route-error shape used by catch boundaries and transition payloads.
- Learn more: [Error Handling](/docs/data/error-handling)

```ts
export interface RouteErrorResponse {
  type: "route_error";
  status: number;
  statusText: string;
  data?: unknown;
  headers?: Record<string, string>;
}
```

## RouteModule

- Kind: interface
- Source: `framework/runtime/types.ts`
- Description: Page route module contract including component and optional route lifecycle exports.
- Learn more: [File-Based Routing](/docs/routing/file-based-routing)

```ts
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
```

## Router

- Kind: interface
- Source: `framework/runtime/router.ts`
- Description: Programmatic navigation contract returned by `useRouter`.
- Learn more: [Navigation](/docs/routing/navigation)

```ts
export interface Router {
  push(href: string, options?: RouterNavigateOptions): void;
  replace(href: string, options?: RouterNavigateOptions): void;
  prefetch(href: string): void;
  back(): void;
  forward(): void;
  refresh(): void;
}
```

## RouterNavigateOptions

- Kind: interface
- Source: `framework/runtime/router.ts`
- Description: Options accepted by `router.push()` and `router.replace()`.
- Learn more: [Navigation](/docs/routing/navigation)

```ts
export interface RouterNavigateOptions {
  scroll?: boolean;
}
```

## startHttpServer

- Kind: function
- Source: `framework/runtime/server.ts`
- Description: Starts Bun HTTP server for configured framework runtime.
- Learn more: [Bun Runtime APIs](/docs/api/bun-runtime-apis), [Bun-only deployment](/docs/deployment/bun-deployment), [Bun APIs](https://bun.com/docs/runtime/bun-apis), [Common HTTP server usage](https://bun.com/docs/guides/http/server)

```ts
startHttpServer(options: { config: FrameworkConfig; runtimeOptions?: ServerRuntimeOptions | undefined; }): void
```

## useLoaderData

- Kind: function
- Source: `framework/runtime/tree.tsx`
- Description: Reads loader data in route components, including deferred values as promises.
- Learn more: [Loaders](/docs/data/loaders)

```ts
useLoaderData<T = unknown>(): T
```

## useParams

- Kind: function
- Source: `framework/runtime/tree.tsx`
- Description: Returns dynamic route params for the current matched route.
- Learn more: [File-Based Routing](/docs/routing/file-based-routing)

```ts
useParams<T extends Params = Params>(): T
```

## useRequestUrl

- Kind: function
- Source: `framework/runtime/tree.tsx`
- Description: Returns the current request URL object in route components.
- Learn more: [Loaders](/docs/data/loaders)

```ts
useRequestUrl(): URL
```

## useRouteError

- Kind: function
- Source: `framework/runtime/tree.tsx`
- Description: Reads error values inside `ErrorBoundary` route components.
- Learn more: [Error Handling](/docs/data/error-handling)

```ts
useRouteError(): unknown
```

## useRouter

- Kind: function
- Source: `framework/runtime/router.ts`
- Description: Returns a Next.js-style router object for programmatic client transitions.
- Learn more: [Navigation](/docs/routing/navigation)

```ts
useRouter(): Router
```
