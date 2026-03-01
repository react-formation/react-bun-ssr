---
title: Middleware
navTitle: Middleware
description: Run request pipeline logic globally and per route tree before loaders, actions, page rendering, and API handlers.
section: Routing
order: 3
kind: guide
tags: middleware,auth,locals,request-pipeline,task-tracker
---

# Middleware

Middleware runs before loaders, actions, page rendering, and API handlers. Use it for auth gates, request-scoped locals, tenant resolution, tracing, and any logic that should happen before route code executes.

## Minimal working example

```ts
// app/middleware.ts
import type { Middleware } from "react-bun-ssr/route";

export const middleware: Middleware = async (ctx, next) => {
  const session = ctx.cookies.get("session");

  ctx.locals.viewer = session
    ? { id: "user_123", role: "member" }
    : null;

  if (!session && ctx.url.pathname.startsWith("/tasks")) {
    return Response.redirect(new URL("/login", ctx.url), 302);
  }

  return next();
};
```

```ts
// app/routes/tasks/_middleware.ts
import type { Middleware } from "react-bun-ssr/route";

export const middleware: Middleware = async (ctx, next) => {
  ctx.locals.section = "tasks";
  return next();
};
```

```tsx
// app/routes/tasks/index.tsx
import { useLoaderData, type Loader } from "react-bun-ssr/route";

export const loader: Loader = ({ locals }) => {
  return {
    viewer: locals.viewer,
    section: locals.section,
  };
};

export default function TasksPage() {
  const data = useLoaderData<{ viewer: unknown; section: unknown }>();
  return <h1>{String(data.section)} dashboard</h1>;
}
```

## Execution order

For a matched page request, middleware runs in this order:

1. `app/middleware.ts`
2. matched ancestor `_middleware.ts` files from top to bottom
3. the matched page route module's `middleware` export
4. the route `loader`, `action`, and final render path

For API routes, the flow is the same except there is no API-module `middleware` export. Use `app/middleware.ts` and nested `_middleware.ts` files for API request middleware.

## What middleware is good for

- checking auth before the route tree runs
- attaching request-scoped data to `ctx.locals`
- normalizing headers, tracing IDs, or tenant information
- short-circuiting with a `Response` when the request should stop early

## Short-circuiting and redirects

Middleware must return a real `Response` or `await next()`.

That matters for redirects:

- use `Response.redirect(...)` from middleware
- do not return `redirect()` from middleware, because that helper is for loaders and actions

A short-circuit response can be a redirect, a `401`, a `403`, or any other response you want to send immediately.

## Route middleware

There are three places middleware can live:

- `app/middleware.ts` for global request pipeline logic
- `app/routes/**/_middleware.ts` for nested route-tree middleware
- `export const middleware = ...` inside the matched page route module

Use `_middleware.ts` when the behavior belongs to a route subtree. Use the route module export when the behavior belongs only to a single leaf page.

## Rules

- Call `next()` at most once.
- Write request-scoped values onto `ctx.locals` for later loader/action access.
- Middleware runs before loaders, actions, and API handlers.
- `ctx.cookies` is still the framework `Map<string, string>` abstraction, not Bun's `CookieMap`.
- API routes use file middleware, not a module-level `middleware` export.

## Related APIs

- [`Middleware`](/docs/api/react-bun-ssr-route)
- [`RequestContext`](/docs/api/react-bun-ssr-route)
- [`LoaderContext`](/docs/api/react-bun-ssr-route)

## Next step

Read [Navigation](/docs/routing/navigation) to see how the request pipeline connects to client-side transitions.
