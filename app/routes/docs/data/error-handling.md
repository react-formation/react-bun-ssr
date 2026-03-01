---
title: Error Handling
navTitle: Error Handling
description: Model caught and uncaught errors with routeError, notFound, CatchBoundary, ErrorComponent, and lifecycle hooks.
section: Data
order: 3
kind: guide
tags: errors,not-found,catch-boundary,tanstack-style
---

# Error Handling

The framework now follows a TanStack-style split between caught errors and uncaught failures.

## Minimal working example

```tsx
import {
  isRouteErrorResponse,
  notFound,
  routeError,
  useRouteError,
  type CatchBoundary,
  type Loader,
} from "react-bun-ssr/route";

export const loader: Loader = async ({ params }) => {
  if (!params.id) {
    throw routeError(400, { message: "Task id is required" });
  }

  if (params.id === "missing") {
    throw notFound({ entity: "task" });
  }

  return { id: params.id };
};

export function CatchBoundary() {
  const error = useRouteError();
  if (isRouteErrorResponse(error)) {
    return <p>{error.status}: {JSON.stringify(error.data)}</p>;
  }
  return <p>Unknown caught error</p>;
}

export function ErrorComponent({ error }: { error: unknown }) {
  return <p>Unexpected failure: {String(error)}</p>;
}
```

## The model

- `routeError(status, data)` throws a typed caught error.
- `notFound(data)` throws a typed 404 caught error.
- `CatchBoundary` renders caught errors.
- `ErrorComponent` or legacy `ErrorBoundary` handles uncaught exceptions.
- `onCatch` and `onError` let routes observe failures without taking over rendering.

## Rules

- Use caught errors for expected request-domain failures.
- Keep uncaught errors for truly exceptional states.
- A thrown non-redirect `Response` is treated as a caught error.
- Existing `NotFound` and `ErrorBoundary` exports still work.

## Related APIs

- [`routeError`](/docs/api/react-bun-ssr-route)
- [`notFound`](/docs/api/react-bun-ssr-route)
- [`isRouteErrorResponse`](/docs/api/react-bun-ssr-route)
- [`RouteErrorResponse`](/docs/api/react-bun-ssr-route)

## Next step

See how errors fit into the document pipeline in [SSR and Hydration](/docs/rendering/ssr-hydration).
