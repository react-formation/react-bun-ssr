---
title: react-bun-ssr Runtime Package API Reference
navTitle: react-bun-ssr
description: Reference the public react-bun-ssr runtime exports for Bun server startup, framework config, JSON helpers, redirects, and deployment types.
section: API
order: 3
kind: api
tags: api,generated
---

# react-bun-ssr Runtime Package API Reference

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
- Source: `framework/runtime/index.ts`
- Description: Route action function signature for handling mutating HTTP requests.
- Learn more: [Actions](/docs/data/actions)

```ts
export type Action = RuntimeAction<AppRouteLocals>;
```

## ActionContext

- Kind: type
- Source: `framework/runtime/index.ts`
- Description: Context object passed to actions with request metadata, parsed body helpers, typed `locals`, request cookies, and staged response mutation helpers.
- Learn more: [Actions](/docs/data/actions), [Bun Runtime APIs](/docs/api/bun-runtime-apis), [Cookies](https://bun.com/docs/api/cookie), [HTTP server cookies](https://bun.com/docs/runtime/http/cookies)

```ts
export type ActionContext = RuntimeActionContext<AppRouteLocals>;
```

## ActionResult

- Kind: type
- Source: `framework/runtime/index.ts`
- Description: Allowed return union for actions, including data, redirects, and `Response` values.
- Learn more: [Actions](/docs/data/actions)

```ts
export type ActionResult = RuntimeActionResult;
```

## ApiRouteModule

- Kind: type
- Source: `framework/runtime/index.ts`
- Description: Contract for API route modules exporting method handlers like `GET` and `POST`.
- Learn more: [File-Based Routing](/docs/routing/file-based-routing)

```ts
export type ApiRouteModule = RuntimeApiRouteModule;
```

## AppRouteLocals

- Kind: interface
- Source: `framework/runtime/index.ts`
- Description: Module-augmentation surface for typing `ctx.locals` across middleware, loaders, actions, and API handlers.
- Learn more: [Middleware](/docs/routing/middleware)

```ts
export interface AppRouteLocals extends Record<string, unknown> {}
```

## assertSameOriginAction

- Kind: function
- Source: `framework/runtime/helpers.ts`
- Description: Throws a typed 403 route error when an action request declares a cross-origin source.
- Learn more: [Actions](/docs/data/actions)

```ts
assertSameOriginAction(ctx: Pick<RequestContext<AppRouteLocals>, "request" | "url">): void
```

## BuildManifest

- Kind: type
- Source: `framework/runtime/index.ts`
- Description: Production manifest describing built route assets used for SSR document injection.
- Learn more: [Build Output](/docs/tooling/build-output)

```ts
export type BuildManifest = RuntimeBuildManifest;
```

## BuildRouteAsset

- Kind: type
- Source: `framework/runtime/index.ts`
- Description: Per-route client asset metadata (entry script and CSS files).
- Learn more: [Build Output](/docs/tooling/build-output)

```ts
export type BuildRouteAsset = RuntimeBuildRouteAsset;
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

- Kind: type
- Source: `framework/runtime/index.ts`
- Description: Typed wrapper returned by `defer()` for loaders with immediate and deferred values.
- Learn more: [Loaders](/docs/data/loaders)

```ts
export type DeferredLoaderResult = RuntimeDeferredLoaderResult;
```

## DeferredToken

- Kind: type
- Source: `framework/runtime/index.ts`
- Description: Serialized payload token used internally to revive deferred values during hydration.
- Learn more: [Streaming and Deferred](/docs/rendering/streaming-deferred)

```ts
export type DeferredToken = RuntimeDeferredToken;
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

- Kind: type
- Source: `framework/runtime/index.ts`
- Description: Main framework configuration surface for paths, server mode, response headers, and server bytecode behavior.
- Learn more: [Configuration](/docs/deployment/configuration)

```ts
export type FrameworkConfig = RuntimeFrameworkConfig;
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
  onNavigate?: (info: RouterNavigateInfo) => void;
}
```

## Loader

- Kind: type
- Source: `framework/runtime/index.ts`
- Description: Route loader function signature for GET/HEAD data requests.
- Learn more: [Loaders](/docs/data/loaders)

```ts
export type Loader = RuntimeLoader<AppRouteLocals>;
```

## LoaderContext

- Kind: type
- Source: `framework/runtime/index.ts`
- Description: Context object passed to loaders with URL, params, typed `locals`, request cookies, and staged response mutation helpers.
- Learn more: [Loaders](/docs/data/loaders), [Bun Runtime APIs](/docs/api/bun-runtime-apis), [Cookies](https://bun.com/docs/api/cookie), [HTTP server cookies](https://bun.com/docs/runtime/http/cookies)

```ts
export type LoaderContext = RuntimeLoaderContext<AppRouteLocals>;
```

## LoaderResult

- Kind: type
- Source: `framework/runtime/index.ts`
- Description: Allowed return union for loaders, including plain data, redirects, deferred data, and `Response`.
- Learn more: [Loaders](/docs/data/loaders)

```ts
export type LoaderResult = RuntimeLoaderResult;
```

## Middleware

- Kind: type
- Source: `framework/runtime/index.ts`
- Description: Middleware function contract executed around page and API handlers.
- Learn more: [Layouts and Groups](/docs/routing/layouts-and-groups)

```ts
export type Middleware = RuntimeMiddleware<AppRouteLocals>;
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
- Source: `framework/runtime/index.ts`
- Description: Dynamic URL params object shape exposed to loaders, actions, and hooks.
- Learn more: [File-Based Routing](/docs/routing/file-based-routing)

```ts
export type Params = RuntimeParams;
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

- Kind: type
- Source: `framework/runtime/index.ts`
- Description: Redirect descriptor shape with destination and HTTP redirect status.
- Learn more: [Actions](/docs/data/actions)

```ts
export type RedirectResult = RuntimeRedirectResult;
```

## RequestContext

- Kind: type
- Source: `framework/runtime/index.ts`
- Description: Base request context shared by middleware, loaders, actions, and API handlers, including typed `locals`, request cookies, and staged response mutation helpers.
- Learn more: [Layouts and Groups](/docs/routing/layouts-and-groups), [Bun Runtime APIs](/docs/api/bun-runtime-apis), [Cookies](https://bun.com/docs/api/cookie), [HTTP server cookies](https://bun.com/docs/runtime/http/cookies)

```ts
export type RequestContext = RuntimeRequestContext<AppRouteLocals>;
```

## ResponseContext

- Kind: type
- Source: `framework/runtime/index.ts`
- Description: Response-side context available on `ctx.response` with mutable headers and cookies that are committed to the final HTTP response.
- Learn more: [Actions](/docs/data/actions)

```ts
export type ResponseContext = RuntimeResponseContext;
```

## ResponseCookieOptions

- Kind: type
- Source: `framework/runtime/index.ts`
- Description: Cookie options accepted by `ctx.response.cookies.set(...)`.
- Learn more: [Bun Runtime APIs](/docs/api/bun-runtime-apis)

```ts
export type ResponseCookieOptions = RuntimeResponseCookieOptions;
```

## ResponseCookies

- Kind: type
- Source: `framework/runtime/index.ts`
- Description: Cookie mutation helpers for staged `get`, `set`, and `delete` operations on `ctx.response`.
- Learn more: [Actions](/docs/data/actions)

```ts
export type ResponseCookies = RuntimeResponseCookies;
```

## ResponseHeaderRule

- Kind: type
- Source: `framework/runtime/index.ts`
- Description: Path-based response header rule used by `FrameworkConfig.headers`.
- Learn more: [Configuration](/docs/deployment/configuration)

```ts
export type ResponseHeaderRule = RuntimeResponseHeaderRule;
```

## RouteCatchContext

- Kind: type
- Source: `framework/runtime/index.ts`
- Description: Context passed to `onCatch` lifecycle hooks when a typed caught route error is handled.
- Learn more: [Error Handling](/docs/data/error-handling)

```ts
export type RouteCatchContext = RuntimeRouteCatchContext;
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

- Kind: type
- Source: `framework/runtime/index.ts`
- Description: Context passed to `onError` lifecycle hooks for uncaught route failures.
- Learn more: [Error Handling](/docs/data/error-handling)

```ts
export type RouteErrorContext = RuntimeRouteErrorContext;
```

## RouteErrorResponse

- Kind: type
- Source: `framework/runtime/index.ts`
- Description: Serializable caught route-error shape used by catch boundaries and transition payloads.
- Learn more: [Error Handling](/docs/data/error-handling)

```ts
export type RouteErrorResponse = RuntimeRouteErrorResponse;
```

## RouteModule

- Kind: type
- Source: `framework/runtime/index.ts`
- Description: Page route module contract including component and optional route lifecycle exports.
- Learn more: [File-Based Routing](/docs/routing/file-based-routing)

```ts
export type RouteModule = RuntimeRouteModule;
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
  onNavigate(listener: RouterNavigateListener): void;
}
```

## RouterNavigateInfo

- Kind: interface
- Source: `framework/runtime/router.ts`
- Description: Navigation result payload delivered to `Link.onNavigate`, including the resolved `nextUrl`.
- Learn more: [Navigation](/docs/routing/navigation)

```ts
export interface RouterNavigateInfo {
  from: string;
  to: string;
  nextUrl: URL;
  status: number;
  kind: "page" | "not_found" | "catch" | "error";
  redirected: boolean;
  prefetched: boolean;
}
```

## RouterNavigateListener

- Kind: type
- Source: `framework/runtime/router.ts`
- Description: Listener signature accepted by `router.onNavigate`, receiving the resolved `nextUrl` after completed client-side navigations.
- Learn more: [Navigation](/docs/routing/navigation)

```ts
export type RouterNavigateListener = (nextUrl: URL) => void;
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

## sanitizeRedirectTarget

- Kind: function
- Source: `framework/runtime/helpers.ts`
- Description: Normalizes user-provided redirect targets to safe site-relative paths and falls back when inputs are unsafe.
- Learn more: [Actions](/docs/data/actions)

```ts
sanitizeRedirectTarget(value: string | null | undefined, fallback?: string): string
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
- Description: Returns a Next.js-style router object for programmatic client transitions and route-change listeners via `router.onNavigate(...)`.
- Learn more: [Navigation](/docs/routing/navigation)

```ts
useRouter(): Router
```
