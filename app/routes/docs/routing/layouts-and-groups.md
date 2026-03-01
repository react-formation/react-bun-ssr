---
title: Layouts and Groups
navTitle: Layouts and Groups
description: Share shells, route middleware, and URL-free group structure without breaking route boundaries.
section: Routing
order: 2
kind: guide
tags: layouts,groups,middleware
---

# Layouts and Groups

Nested layouts let the `Task Tracker` keep shared chrome mounted while page content changes underneath it.

## Minimal working example

```tsx
// app/routes/tasks/_layout.tsx
import { Link, Outlet } from "react-bun-ssr/route";

export default function TasksLayout() {
  return (
    <main>
      <header>
        <h1>Task Tracker</h1>
        <nav>
          <Link to="/tasks">All tasks</Link>
          <Link to="/tasks/new">New task</Link>
        </nav>
      </header>
      <Outlet />
    </main>
  );
}
```

```text
app/routes/
  (app)/
    tasks/
      _layout.tsx
      index.tsx
      [id].tsx
```

The `(app)` directory groups routes without adding `/app` to the URL.

## Why it matters

Layouts are the backbone for client transitions:

- shared UI stays mounted
- only the changing leaf route swaps
- shared data and navigation state can remain stable

## Rules

- `_layout.tsx` wraps nested routes.
- `(group)` directories organize route files without changing the public path.
- `_middleware.ts` runs alongside the matched layout/page chain.

For request-pipeline order, `ctx.locals`, and short-circuit response behavior, read [Middleware](/docs/routing/middleware).

## Related APIs

- [`Outlet`](/docs/api/react-bun-ssr-route)
- [`Middleware`](/docs/api/react-bun-ssr-route)

## Next step

Read [Middleware](/docs/routing/middleware) to see how request flow layers onto the shared route graph.
