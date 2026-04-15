---
title: react-bun-ssr Route Module API Reference
navTitle: react-bun-ssr/route
description: Reference route module contracts, loaders, actions, hooks, navigation helpers, and error primitives for Bun-native React SSR routes.
section: API
order: 4
kind: api
tags: api,generated
---

# react-bun-ssr Route Module API Reference

Auto-generated from framework TypeScript exports. Do not edit manually.

Use this entrypoint inside route modules for hooks, route contract types, navigation helpers, and TanStack-style route error primitives. It is the package you import from day-to-day while building routes.

## Examples

### Loader + `useLoaderData`

```tsx
import { useLoaderData, type Loader } from "react-bun-ssr/route";

export const loader: Loader = ({ params }) => {
  return { postId: params.id ?? "unknown" };
};

export default function PostPage() {
  const data = useLoaderData<{ postId: string }>();
  return <h1>Post {data.postId}</h1>;
}
```

### React useActionState + direct route action stub

```tsx

import { useActionState } from "react";
import { createRouteAction } from "react-bun-ssr/route";

type ActionData = { error?: string };

// app/routes/form.tsx
export const action = createRouteAction<ActionData>();

export default function FormRoute() {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction}>
      {state.error ? <p>{state.error}</p> : null}
      <button disabled={pending}>Save</button>
    </form>
  );
};

// app/routes/form.server.tsx
import { assertSameOriginAction, redirect, sanitizeRedirectTarget } from "react-bun-ssr";
import type { Action } from "react-bun-ssr/route";

export const action: Action = async (ctx) => {
  assertSameOriginAction(ctx);
  const name = String(ctx.formData?.get("name") ?? "").trim();
  if (!name) return { error: "name is required" } satisfies ActionData;
  ctx.response.cookies.set("flash", "saved", { path: "/" });
  const next = sanitizeRedirectTarget(String(ctx.formData?.get("next") ?? "/docs/data/actions"));
  return redirect(next);
};
```

### Route middleware

```tsx
import type { Middleware } from "react-bun-ssr/route";

export const middleware: Middleware = async (ctx, next) => {
  if (!ctx.cookies.get("session")) {
    return new Response("Unauthorized", { status: 401 });
  }
  return next();
};
```

### Deferred loader data

```tsx
import { Suspense, use } from "react";
import { defer, useLoaderData, type Loader } from "react-bun-ssr/route";

export const loader: Loader = () => {
  return defer({
    title: "Dashboard",
    stats: Promise.resolve({ users: 42 }),
  });
};

function Stats(props: { stats: Promise<{ users: number }> }) {
  const value = use(props.stats);
  return <p>Users: {value.users}</p>;
}

export default function DashboardPage() {
  const data = useLoaderData<{ title: string; stats: Promise<{ users: number }> }>();
  return (
    <>
      <h1>{data.title}</h1>
      <Suspense fallback={<p>Loading stats…</p>}>
        <Stats stats={data.stats} />
      </Suspense>
    </>
  );
}
```

## Exported symbols

## Action

- Kind: type
- Source: `framework/runtime/route-api.ts`
- Description: Route action function signature for handling mutating HTTP requests.
- Learn more: [Actions](/docs/data/actions)

```ts
export type Action = RuntimeAction<AppRouteLocals>;
```

## ActionContext

- Kind: type
- Source: `framework/runtime/route-api.ts`
- Description: Context object passed to actions with request metadata, parsed body helpers, typed `locals`, request cookies, and staged response mutation helpers.
- Learn more: [Actions](/docs/data/actions), [Bun Runtime APIs](/docs/api/bun-runtime-apis), [Cookies](https://bun.com/docs/api/cookie), [HTTP server cookies](https://bun.com/docs/runtime/http/cookies)

```ts
export type ActionContext = RuntimeActionContext<AppRouteLocals>;
```

## ActionResult

- Kind: type
- Source: `framework/runtime/route-api.ts`
- Description: Allowed return union for actions, including data, redirects, and `Response` values.
- Learn more: [Actions](/docs/data/actions)

```ts
export type ActionResult = RuntimeActionResult;
```

## AppRouteLocals

- Kind: interface
- Source: `framework/runtime/route-api.ts`
- Description: Module-augmentation surface for typing `ctx.locals` across middleware, loaders, actions, and API handlers.
- Learn more: [Middleware](/docs/routing/middleware)

```ts
export interface AppRouteLocals extends RootAppRouteLocals, Record<string, unknown> {}
```

## assertSameOriginAction

- Kind: function
- Source: `framework/runtime/helpers.ts`
- Description: Throws a typed 403 route error when an action request declares a cross-origin source.
- Learn more: [Actions](/docs/data/actions)

```ts
assertSameOriginAction(ctx: Pick<RequestContext<AppRouteLocals>, "request" | "url">): void
```

## createRouteAction

- Kind: function
- Source: `framework/runtime/tree.tsx`
- Description: Creates a client action stub compatible with `useActionState(action, initialState)` for current-route page mutations.
- Learn more: [Actions](/docs/data/actions)

```ts
createRouteAction<TState = unknown>(): RouteActionStateHandler<TState>
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
- Source: `framework/runtime/route-api.ts`
- Description: Typed wrapper returned by `defer()` for loaders with immediate and deferred values.
- Learn more: [Loaders](/docs/data/loaders)

```ts
export type DeferredLoaderResult = RuntimeDeferredLoaderResult;
```

## DeferredToken

- Kind: type
- Source: `framework/runtime/route-api.ts`
- Description: Serialized payload token used internally to revive deferred values during hydration.
- Learn more: [Streaming and Deferred](/docs/rendering/streaming-deferred)

```ts
export type DeferredToken = RuntimeDeferredToken;
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
- Source: `framework/runtime/route-api.ts`
- Description: Route loader function signature for GET/HEAD data requests.
- Learn more: [Loaders](/docs/data/loaders)

```ts
export type Loader = RuntimeLoader<AppRouteLocals>;
```

## LoaderContext

- Kind: type
- Source: `framework/runtime/route-api.ts`
- Description: Context object passed to loaders with URL, params, typed `locals`, request cookies, and staged response mutation helpers.
- Learn more: [Loaders](/docs/data/loaders), [Bun Runtime APIs](/docs/api/bun-runtime-apis), [Cookies](https://bun.com/docs/api/cookie), [HTTP server cookies](https://bun.com/docs/runtime/http/cookies)

```ts
export type LoaderContext = RuntimeLoaderContext<AppRouteLocals>;
```

## LoaderResult

- Kind: type
- Source: `framework/runtime/route-api.ts`
- Description: Allowed return union for loaders, including plain data, redirects, deferred data, and `Response`.
- Learn more: [Loaders](/docs/data/loaders)

```ts
export type LoaderResult = RuntimeLoaderResult;
```

## Middleware

- Kind: type
- Source: `framework/runtime/route-api.ts`
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
- Source: `framework/runtime/route-api.ts`
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
- Source: `framework/runtime/route-api.ts`
- Description: Redirect descriptor shape with destination and HTTP redirect status.
- Learn more: [Actions](/docs/data/actions)

```ts
export type RedirectResult = RuntimeRedirectResult;
```

## RequestContext

- Kind: type
- Source: `framework/runtime/route-api.ts`
- Description: Base request context shared by middleware, loaders, actions, and API handlers, including typed `locals`, request cookies, and staged response mutation helpers.
- Learn more: [Layouts and Groups](/docs/routing/layouts-and-groups), [Bun Runtime APIs](/docs/api/bun-runtime-apis), [Cookies](https://bun.com/docs/api/cookie), [HTTP server cookies](https://bun.com/docs/runtime/http/cookies)

```ts
export type RequestContext = RuntimeRequestContext<AppRouteLocals>;
```

## ResponseContext

- Kind: type
- Source: `framework/runtime/route-api.ts`
- Description: Response-side context available on `ctx.response` with mutable headers and cookies that are committed to the final HTTP response.
- Learn more: [Actions](/docs/data/actions)

```ts
export type ResponseContext = RuntimeResponseContext;
```

## ResponseCookieOptions

- Kind: type
- Source: `framework/runtime/route-api.ts`
- Description: Cookie options accepted by `ctx.response.cookies.set(...)`.
- Learn more: [Bun Runtime APIs](/docs/api/bun-runtime-apis)

```ts
export type ResponseCookieOptions = RuntimeResponseCookieOptions;
```

## ResponseCookies

- Kind: type
- Source: `framework/runtime/route-api.ts`
- Description: Cookie mutation helpers for staged `get`, `set`, and `delete` operations on `ctx.response`.
- Learn more: [Actions](/docs/data/actions)

```ts
export type ResponseCookies = RuntimeResponseCookies;
```

## RouteCatchContext

- Kind: type
- Source: `framework/runtime/route-api.ts`
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
- Source: `framework/runtime/route-api.ts`
- Description: Context passed to `onError` lifecycle hooks for uncaught route failures.
- Learn more: [Error Handling](/docs/data/error-handling)

```ts
export type RouteErrorContext = RuntimeRouteErrorContext;
```

## RouteErrorResponse

- Kind: type
- Source: `framework/runtime/route-api.ts`
- Description: Serializable caught route-error shape used by catch boundaries and transition payloads.
- Learn more: [Error Handling](/docs/data/error-handling)

```ts
export type RouteErrorResponse = RuntimeRouteErrorResponse;
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

## useRouteAction

- Kind: function
- Source: `framework/runtime/tree.tsx`
- Description: Returns a route-action submit function compatible with React `useActionState` for page mutations (legacy-compatible helper).
- Learn more: [Actions](/docs/data/actions)

```ts
useRouteAction<TState = unknown>(): RouteActionStateHandler<TState>
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
