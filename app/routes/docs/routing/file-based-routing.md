---
title: File-Based Routing
navTitle: File-Based Routing
description: Map files to URLs for pages, APIs, markdown routes, dynamic params, catchalls, and route groups.
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
  tasks/
    index.tsx
    [id].tsx
    [...filters].tsx
  api/
    tasks.ts
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

## Rules

- `.md` is supported as a page route.
- `.mdx` route files are rejected explicitly.
- `_layout` and `_middleware` participate in routing but do not become public URLs.
- Route-group directories like `(marketing)` affect organization, not the URL.
- Use `NotFound` for unmatched URLs and `notFound()` for matched routes with missing data.

## Related APIs

- [`Params`](/docs/api/react-bun-ssr-route)
- [`RouteModule`](/docs/api/react-bun-ssr-route)
- [`ApiRouteModule`](/docs/api/react-bun-ssr)
- [`notFound`](/docs/api/react-bun-ssr-route)

## Next step

Use [Layouts and Groups](/docs/routing/layouts-and-groups) to shape the route tree, then read [Middleware](/docs/routing/middleware) for request-pipeline behavior.
