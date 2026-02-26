---
title: Routing model
description: File to URL mapping for static, dynamic, catch-all, and API routes.
section: Core Concepts
order: 1
tags: routing,dynamic
---

# Routing model

## File conventions

- `index.tsx` -> `/`
- `[id].tsx` -> `/:id`
- `[...slug].tsx` -> `/*slug`
- `guide.md` -> `/guide`
- `(group)` directories are ignored in URL mapping.

## Markdown routes (`.md`)

You can create page routes directly from markdown files under `app/routes`.

Example:

- `app/routes/getting-started.md` becomes `/getting-started`

Markdown routes are compiled into framework-generated route modules and rendered with SSR + hydration parity.

### How markdown routing works

1. Route scanning includes `.md` files as page routes.
2. Each markdown file is compiled to HTML with Bun markdown.
3. The framework generates an internal TSX wrapper module for that route.
4. Server render and client hydration both import the same generated wrapper module.

This means markdown routes behave like normal page routes for layouts, middleware, and route matching.

## Why `.mdx` is unsupported (for now)

`.mdx` route files are currently rejected with a clear error.
Use `.md` for native markdown routes, or a `.tsx` route module when you need JSX/components.

## API routes

Place handlers in `app/routes/api/**/*.ts` and export method-named functions (`GET`, `POST`, ...).

## Client-side transitions with `Link`

Use `Link` from `react-bun-ssr/route` for internal navigation.

```tsx
import { Link } from "react-bun-ssr/route";

export default function Home() {
  return <Link to="/docs/core-concepts/loaders">Read loaders guide</Link>;
}
```

Behavior:

- no full document reload for same-origin links
- shared layout UI stays mounted
- route data is fetched through framework transition streams
- route `<head>` tags are reconciled after navigation

`<a>` elements still do normal browser navigation. For client transitions, use `Link`.

## Programmatic navigation with `useRouter`

Use `useRouter` when you need imperative navigation from event handlers.

```tsx
import { useRouter } from "react-bun-ssr/route";

export default function ActionsPanel() {
  const router = useRouter();

  return (
    <div>
      <button onClick={() => router.push("/docs/core-concepts/loaders")}>
        Go to loaders
      </button>
      <button onClick={() => router.replace("/docs/core-concepts/actions")}>
        Replace with actions
      </button>
      <button onClick={() => router.prefetch("/docs/rendering/ssr-hydration")}>
        Prefetch SSR docs
      </button>
      <button onClick={() => router.back()}>Back</button>
      <button onClick={() => router.forward()}>Forward</button>
      <button onClick={() => router.refresh()}>Refresh page</button>
    </div>
  );
}
```

Methods:

- `router.push(href, { scroll })`
- `router.replace(href, { scroll })`
- `router.prefetch(href)`
- `router.back()`
- `router.forward()`
- `router.refresh()`

Compatibility note:

- `Link` transitions and `router.push`/`router.replace` prefer the browser Navigation API when available.
- `back`, `forward`, and `refresh` also use the Navigation API when available.
- Browsers without Navigation API support automatically fall back to `history`/`location` APIs.
