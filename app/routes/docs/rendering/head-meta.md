---
title: HTML Head Metadata for React SSR Routes
navTitle: Head and Meta
description: Set route titles, meta descriptions, Open Graph tags, and head output in react-bun-ssr so SEO, hydration, and transitions stay aligned.
section: Rendering
order: 3
kind: guide
tags: seo,head,meta,title
---

# Head and Meta

Each route can contribute document metadata. The framework renders it on the server and reconciles the managed head region during soft transitions.

## Minimal working example

```tsx
export function head() {
  return <title>Task Tracker | Open Tasks</title>;
}

export function meta() {
  return {
    description: "Track open work with Bun-native SSR and soft transitions.",
    "og:title": "Task Tracker | Open Tasks",
    "og:type": "website",
    keywords: "tasks,react,bun,ssr",
  };
}
```

## Why this matters

Accessible client transitions rely on unique route titles. Search engines and social previews do too.

## Rules

- `<title>` should resolve to a single string value.
- Keep metadata deterministic between server render and hydration.
- Prefer route-specific titles over generic app-wide titles.

## Related APIs

- [`RouteModule`](/docs/api/react-bun-ssr-route)
- [`useRouter`](/docs/api/react-bun-ssr-route)

## Next step

Move into [CSS Modules](/docs/styling/css-modules) to style the app without a global CSS dump.
