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

## Exported symbols

## Action

- Kind: type
- Source: `framework/runtime/types.ts`

```ts
export type Action = (ctx: ActionContext) => Promise<ActionResult> | ActionResult;
```

## ActionContext

- Kind: interface
- Source: `framework/runtime/types.ts`

```ts
export interface ActionContext extends RequestContext {
```

## ActionResult

- Kind: type
- Source: `framework/runtime/types.ts`

```ts
export type ActionResult = LoaderResult | RedirectResult;
```

## json

- Kind: function
- Source: `framework/runtime/helpers.ts`

```ts
json(data: unknown, init?: ResponseInit): Response
```

## Loader

- Kind: type
- Source: `framework/runtime/types.ts`

```ts
export type Loader = (ctx: LoaderContext) => Promise<LoaderResult> | LoaderResult;
```

## LoaderContext

- Kind: interface
- Source: `framework/runtime/types.ts`

```ts
export interface LoaderContext extends RequestContext {}
```

## LoaderResult

- Kind: type
- Source: `framework/runtime/types.ts`

```ts
export type LoaderResult =
```

## Middleware

- Kind: type
- Source: `framework/runtime/types.ts`

```ts
export type Middleware = (
```

## Outlet

- Kind: function
- Source: `framework/runtime/tree.tsx`

```ts
Outlet(): ReactElement<unknown, string | JSXElementConstructor<any>> | null
```

## Params

- Kind: type
- Source: `framework/runtime/types.ts`

```ts
export type Params = Record<string, string>;
```

## redirect

- Kind: function
- Source: `framework/runtime/helpers.ts`

```ts
redirect(location: string, status?: 301 | 302 | 303 | 307 | 308 | undefined): RedirectResult
```

## RedirectResult

- Kind: interface
- Source: `framework/runtime/types.ts`

```ts
export interface RedirectResult {
```

## RequestContext

- Kind: interface
- Source: `framework/runtime/types.ts`

```ts
export interface RequestContext {
```

## useLoaderData

- Kind: function
- Source: `framework/runtime/tree.tsx`

```ts
useLoaderData<T = unknown>(): T
```

## useParams

- Kind: function
- Source: `framework/runtime/tree.tsx`

```ts
useParams<T extends Params = Params>(): T
```

## useRequestUrl

- Kind: function
- Source: `framework/runtime/tree.tsx`

```ts
useRequestUrl(): URL
```

## useRouteError

- Kind: function
- Source: `framework/runtime/tree.tsx`

```ts
useRouteError(): unknown
```
