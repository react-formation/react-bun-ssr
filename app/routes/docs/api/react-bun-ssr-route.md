---
title: react-bun-ssr/route
description: Route module contracts, hooks, and helpers exposed to application routes.
section: API Reference
order: 3
tags: api,generated
---

# react-bun-ssr/route

Auto-generated from framework TypeScript exports. Do not edit manually.

Use this entrypoint inside route modules for hooks (`useLoaderData`, `useParams`, `Outlet`) and route contract types (`Loader`, `Action`, `Middleware`).

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

### Action + redirect helper

```tsx
import { redirect } from "react-bun-ssr";
import type { Action } from "react-bun-ssr/route";

export const action: Action = async ({ formData }) => {
  const name = String(formData?.get("name") ?? "").trim();
  if (!name) return { error: "name is required" };
  return redirect("/docs/core-concepts/actions");
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
- Source: `framework/runtime/types.ts`
- Description: Route action function signature for handling mutating HTTP requests.
- Learn more: [Actions and mutation flow](/docs/core-concepts/actions)

```ts
export type Action = (ctx: ActionContext) => Promise<ActionResult> | ActionResult;
```

## ActionContext

- Kind: interface
- Source: `framework/runtime/types.ts`
- Description: Context object passed to actions with request metadata and parsed body helpers.
- Learn more: [Actions and mutation flow](/docs/core-concepts/actions)

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
- Learn more: [Actions and mutation flow](/docs/core-concepts/actions)

```ts
export type ActionResult = LoaderResult | RedirectResult;
```

## defer

- Kind: variable
- Source: `framework/runtime/helpers.ts`
- Description: Marks loader return data as deferred so promise-backed keys can stream progressively.
- Learn more: [Loaders and data flow](/docs/core-concepts/loaders), [SSR and hydration](/docs/rendering/ssr-hydration)

```ts
defer<T extends Record<string, unknown>>(data: T): DeferredLoaderResult<T>
```

## DeferredLoaderResult

- Kind: interface
- Source: `framework/runtime/types.ts`
- Description: Typed wrapper returned by `defer()` for loaders with immediate and deferred values.
- Learn more: [Loaders and data flow](/docs/core-concepts/loaders)

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
- Learn more: [SSR and hydration](/docs/rendering/ssr-hydration)

```ts
export interface DeferredToken {
  __rbssrDeferred: string;
}
```

## isRouteErrorResponse

- Kind: function
- Source: `framework/runtime/route-errors.ts`
- Description: Type guard for narrowing unknown errors to framework caught route errors.
- Learn more: [Error boundaries and not-found](/docs/rendering/error-and-not-found)

```ts
isRouteErrorResponse(value: unknown): value is RouteErrorResponse
```

## json

- Kind: function
- Source: `framework/runtime/helpers.ts`
- Description: Creates a JSON `Response` with a default UTF-8 content-type.
- Learn more: [API reference overview](/docs/api-reference/overview)

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
- Learn more: [Loaders and data flow](/docs/core-concepts/loaders)

```ts
export type Loader = (ctx: LoaderContext) => Promise<LoaderResult> | LoaderResult;
```

## LoaderContext

- Kind: interface
- Source: `framework/runtime/types.ts`
- Description: Context object passed to loaders with URL, params, cookies, and mutable locals.
- Learn more: [Loaders and data flow](/docs/core-concepts/loaders)

```ts
export interface LoaderContext extends RequestContext {}
```

## LoaderResult

- Kind: type
- Source: `framework/runtime/types.ts`
- Description: Allowed return union for loaders, including plain data, redirects, deferred data, and `Response`.
- Learn more: [Loaders and data flow](/docs/core-concepts/loaders)

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
- Learn more: [Middleware chain](/docs/core-concepts/middleware)

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
- Learn more: [Error boundaries and not-found](/docs/rendering/error-and-not-found)

```ts
notFound(data?: unknown): never
```

## Outlet

- Kind: function
- Source: `framework/runtime/tree.tsx`
- Description: Renders the next nested route element inside root/layout route modules.
- Learn more: [Nested layouts and route groups](/docs/core-concepts/layouts-and-groups)

```ts
Outlet(): ReactElement<unknown, string | JSXElementConstructor<any>> | null
```

## Params

- Kind: type
- Source: `framework/runtime/types.ts`
- Description: Dynamic URL params object shape exposed to loaders, actions, and hooks.
- Learn more: [Routing model](/docs/core-concepts/routing-model)

```ts
export type Params = Record<string, string>;
```

## redirect

- Kind: function
- Source: `framework/runtime/helpers.ts`
- Description: Returns a framework redirect descriptor consumed by loader/action runtime flow.
- Learn more: [Actions and mutation flow](/docs/core-concepts/actions)

```ts
redirect(location: string, status?: 301 | 302 | 303 | 307 | 308 | undefined): RedirectResult
```

## RedirectResult

- Kind: interface
- Source: `framework/runtime/types.ts`
- Description: Redirect descriptor shape with destination and HTTP redirect status.
- Learn more: [Actions and mutation flow](/docs/core-concepts/actions)

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
- Description: Base request context shared by middleware, loaders, actions, and API handlers.
- Learn more: [Middleware chain](/docs/core-concepts/middleware)

```ts
export interface RequestContext {
  request: Request;
  url: URL;
  params: Params;
  cookies: Map<string, string>;
  locals: Record<string, unknown>;
}
```

## RouteCatchContext

- Kind: interface
- Source: `framework/runtime/types.ts`
- Description: Context passed to `onCatch` lifecycle hooks when a typed caught route error is handled.
- Learn more: [Error boundaries and not-found](/docs/rendering/error-and-not-found)

```ts
export interface RouteCatchContext extends Omit<RouteErrorContext, "error"> {
  error: RouteErrorResponse;
}
```

## routeError

- Kind: function
- Source: `framework/runtime/route-errors.ts`
- Description: Throws a typed caught route error with status/data for TanStack-style catch-boundary flows.
- Learn more: [Error boundaries and not-found](/docs/rendering/error-and-not-found)

```ts
routeError(status: number, data?: unknown, init?: { statusText?: string | undefined; headers?: HeadersInit | undefined; }): never
```

## RouteErrorContext

- Kind: interface
- Source: `framework/runtime/types.ts`
- Description: Context passed to `onError` lifecycle hooks for uncaught route failures.
- Learn more: [Error boundaries and not-found](/docs/rendering/error-and-not-found)

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
- Learn more: [Error boundaries and not-found](/docs/rendering/error-and-not-found)

```ts
export interface RouteErrorResponse {
  type: "route_error";
  status: number;
  statusText: string;
  data?: unknown;
  headers?: Record<string, string>;
}
```

## Router

- Kind: interface
- Source: `framework/runtime/router.ts`
- Description: Programmatic navigation contract returned by `useRouter`.
- Learn more: [Routing model](/docs/core-concepts/routing-model)

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
- Learn more: [Routing model](/docs/core-concepts/routing-model)

```ts
export interface RouterNavigateOptions {
  scroll?: boolean;
}
```

## useLoaderData

- Kind: function
- Source: `framework/runtime/tree.tsx`
- Description: Reads loader data in route components, including deferred values as promises.
- Learn more: [Loaders and data flow](/docs/core-concepts/loaders)

```ts
useLoaderData<T = unknown>(): T
```

## useParams

- Kind: function
- Source: `framework/runtime/tree.tsx`
- Description: Returns dynamic route params for the current matched route.
- Learn more: [Routing model](/docs/core-concepts/routing-model)

```ts
useParams<T extends Params = Params>(): T
```

## useRequestUrl

- Kind: function
- Source: `framework/runtime/tree.tsx`
- Description: Returns the current request URL object in route components.
- Learn more: [Loaders and data flow](/docs/core-concepts/loaders)

```ts
useRequestUrl(): URL
```

## useRouteError

- Kind: function
- Source: `framework/runtime/tree.tsx`
- Description: Reads error values inside `ErrorBoundary` route components.
- Learn more: [Error boundaries and not-found](/docs/rendering/error-and-not-found)

```ts
useRouteError(): unknown
```

## useRouter

- Kind: function
- Source: `framework/runtime/router.ts`
- Description: Returns a Next.js-style router object for programmatic client transitions.
- Learn more: [Routing model](/docs/core-concepts/routing-model)

```ts
useRouter(): Router
```
