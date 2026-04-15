---
title: File-Based Routing for Bun React SSR Apps
navTitle: File-Based Routing
description: Map files to URLs in react-bun-ssr for pages, API handlers, markdown routes, dynamic params, catchalls, layouts, and route groups.
section: Routing
order: 1
kind: guide
tags: routing,files,params,markdown
---

# File-Based Routing

Routing is driven by files under `app/routes`. The shape is close to Next-style conventions, but it stays Bun-native and keeps page and API routes in one tree.

## Minimal working example

```text
app/routes/
  index.tsx
  index.server.tsx
  tasks/
    index.tsx
    _layout.server.tsx
    [id].tsx
    [...filters].tsx
  api/
    tasks.server.ts
  _middleware.server.ts
  docs/
    start/
      overview.md
```

This resolves to:

- `/`
- `/tasks`
- `/tasks/:id`
- `/tasks/*filters`
- `/api/tasks`
- `/docs/start/overview`

## Server-only route files and companions

Use `*.server.ts` / `*.server.tsx` when you need Bun-only imports like `bun:sqlite`, password hashing, or storage clients.

Supported patterns:

- `app/root.server.tsx` as a server companion for `app/root.tsx`
- `app/routes/**/_layout.server.tsx` as a server companion for `_layout.tsx`
- `app/routes/login.server.tsx` as a server companion for `login.tsx`
- `app/middleware.server.ts` for global middleware
- `app/routes/**/_middleware.server.ts` for nested middleware
- `app/routes/api/**.server.ts` for API handlers

Server companions can export only server lifecycle symbols (`loader`, `action`, `middleware`, `head`, `meta`, `onError`, `onCatch`). The base module stays client-safe and owns the component export.

If both the base route module and its companion export the same server symbol, startup/build fails with a clear duplicate-export error.

## Dynamic params

```tsx
import { useParams } from "react-bun-ssr/route";

export default function TaskRoute() {
  const params = useParams();
  return <h1>Task {params.id}</h1>;
}
```

## Markdown routes

A `.md` file under `app/routes` is a first-class page route. The framework compiles it into a generated wrapper module so SSR and hydration use the same output.

## Colocated private files

Files whose basename starts with `_` are ignored by route scanning, except for the reserved `_layout` and `_middleware` conventions.

That gives you a simple way to colocate page-only helpers next to a route without creating accidental public URLs.

```text
app/routes/
  tasks/
    index.tsx
    _card.tsx
    _format-date.ts
    _header.module.css
```

In that example:

- `tasks/index.tsx` creates `/tasks`
- `_card.tsx` does not create a route
- `_format-date.ts` does not create a route
- `_header.module.css` stays a normal colocated stylesheet

Important: this rule applies to files, not folders. A folder like `_admin/` still behaves like a normal route segment and would map into the URL unless you use a route group like `(admin)`.

## 404 handling

Routing also owns the not-found path. There are two main cases:

- no route matches the URL at all
- a dynamic route matches, but the requested resource does not exist

For the first case, export `NotFound` from `app/root.tsx` or a layout route to render the nearest 404 UI.

For the second case, throw `notFound()` from a loader after the route has matched:

```tsx
import { notFound, type Loader } from "react-bun-ssr/route";

export const loader: Loader = async ({ params }) => {
  const task = await loadTask(params.id ?? "");

  if (!task) {
    throw notFound({ entity: "task", id: params.id });
  }

  return { task };
};
```

That keeps URL matching and missing-resource handling separate, which is the right model for dynamic routes.

## Customize the `NotFound` page

Export `NotFound` from the route, layout, or root module where you want the 404 UI to be defined.

```tsx
// app/root.tsx
import { Link } from "react-bun-ssr/route";

export function NotFound() {
  return (
    <main>
      <h1>Page not found</h1>
      <p>The page you requested does not exist or is no longer available.</p>
      <p>
        <Link to="/docs">Back to the docs</Link>
      </p>
    </main>
  );
}
```

You can scope the 404 UI at different levels:

- export `NotFound` from `app/root.tsx` for a site-wide default 404 page
- export `NotFound` from a `_layout.tsx` to customize 404 behavior for a section
- export `NotFound` from a matched page route when missing data should render a route-specific not-found state

Resolution order is:

- matched route `NotFound`
- nearest layout `NotFound`
- root `NotFound`

## Rules

- `.md` is supported as a page route.
- `.mdx` route files are rejected explicitly.
- `_layout` and `_middleware` participate in routing but do not become public URLs.
- `.server` suffixes are stripped from route IDs and URL paths.
- `*.server` companions and server-only files are excluded from client entry generation.
- Other files that start with `_` are treated as private colocated files and do not become routes.
- Folders that start with `_` still behave like normal route segments.
- Route-group directories like `(marketing)` affect organization, not the URL.
- Use `NotFound` for unmatched URLs and `notFound()` for matched routes with missing data.
- The nearest `NotFound` export wins.

## Related APIs

- [`Params`](/docs/api/react-bun-ssr-route)
- [`RouteModule`](/docs/api/react-bun-ssr-route)
- [`ApiRouteModule`](/docs/api/react-bun-ssr)
- [`notFound`](/docs/api/react-bun-ssr-route)

## Next step

Use [Layouts and Groups](/docs/routing/layouts-and-groups) to shape the route tree, then read [Middleware](/docs/routing/middleware) for request-pipeline behavior.
