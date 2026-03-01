---
title: Navigation
navTitle: Navigation
description: Use Link, useRouter, prefetching, route announcements, and soft transitions for Bun-native SSR apps.
section: Routing
order: 4
kind: guide
tags: navigation,link,router,transitions
---

# Navigation

`react-bun-ssr` keeps server rendering as the source of truth, but internal navigation can stay client-side when you use framework primitives.

## Minimal working example

```tsx
import { Link, useRouter } from "react-bun-ssr/route";

export default function TaskNav() {
  const router = useRouter();

  return (
    <>
      <Link to="/tasks" prefetch="intent">Tasks</Link>
      <button type="button" onClick={() => router.push("/tasks/new") }>
        Create task
      </button>
    </>
  );
}
```

## What happens on a client transition

- shared layouts stay mounted
- the framework fetches route payloads from its transition endpoint
- deferred data continues streaming through the transition channel
- the managed `<head>` region is reconciled for the destination route
- the route announcer updates assistive technology with the new page title

## Prefetching

`Link` defaults to `prefetch="intent"`, which means hover, focus, and touchstart can warm the route payload before the click.

## Rules

- Use `Link` for internal navigation.
- Plain `<a>` stays a full browser navigation by design.
- `useRouter().refresh()` is a hard reload.
- `push()` and `replace()` prefer the Navigation API when available and fall back automatically.

## Related APIs

- [`Link`](/docs/api/react-bun-ssr-route)
- [`useRouter`](/docs/api/react-bun-ssr-route)
- [`Router`](/docs/api/react-bun-ssr-route)

## Next step

Move into [Loaders](/docs/data/loaders) to see how route data participates in SSR and transitions.
