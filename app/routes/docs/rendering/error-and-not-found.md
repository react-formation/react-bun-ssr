---
title: Error boundaries and not-found
description: TanStack-style caught errors, boundary precedence, and lifecycle hooks.
section: Rendering
order: 2
tags: errors,not-found
---

# Error boundaries and not-found

`react-bun-ssr` supports two error channels:

- caught route errors (`routeError`, `notFound`)
- uncaught runtime errors (`throw new Error(...)`)

## Caught errors

Use `routeError(status, data?)` for typed caught failures and `notFound(data?)` for 404 flows.

```tsx
import { notFound, routeError } from "react-bun-ssr/route";

export async function loader({ params }: { params: { id: string } }) {
  if (!params.id) return notFound({ reason: "missing id" });
  if (params.id === "blocked") return routeError(403, { reason: "forbidden" });
  return { id: params.id };
}
```

Boundary handling for caught errors:

- nearest `CatchBoundary`
- fallback to `ErrorComponent`
- fallback to legacy `ErrorBoundary`

For caught `404`, the runtime prefers nearest `NotFound` when available.

```tsx
import { isRouteErrorResponse, useRouteError } from "react-bun-ssr/route";

export function CatchBoundary() {
  const error = useRouteError();
  if (isRouteErrorResponse(error)) {
    return <p>Caught {error.status}</p>;
  }
  return <p>Unknown route error</p>;
}
```

## Uncaught errors

Uncaught loader/action/render/middleware errors resolve to:

- nearest `ErrorComponent`
- fallback to legacy `ErrorBoundary`

In production, uncaught errors are sanitized before response.

## Lifecycle hooks

Route modules can observe failures with:

- `onCatch(ctx)` for caught route errors
- `onError(ctx)` for uncaught errors

Invocation order is deterministic: route -> nearest layout -> root.
