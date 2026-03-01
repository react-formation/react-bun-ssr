---
title: SSR and Hydration
navTitle: SSR and Hydration
description: Understand full-document SSR, payload injection, and how the client revives the same route tree without drift.
section: Rendering
order: 1
kind: guide
tags: ssr,hydration,document,payload
---

# SSR and Hydration

`react-bun-ssr` renders full HTML documents on the server. Hydration then revives the same route tree in the browser.

## Minimal working example

```tsx
// app/root.tsx
import { Outlet } from "react-bun-ssr/route";

export default function RootLayout() {
  return (
    <html lang="en">
      <body>
        <Outlet />
      </body>
    </html>
  );
}
```

```tsx
// app/routes/tasks/[id].tsx
import { useLoaderData } from "react-bun-ssr/route";

export async function loader({ params }: { params: { id?: string } }) {
  return { id: params.id ?? "unknown" };
}

export default function TaskPage() {
  const data = useLoaderData<{ id: string }>();
  return <h1>Task {data.id}</h1>;
}
```

## What is rendered into the document

- managed `<head>` output
- route HTML under `#rbssr-root`
- serialized loader payload
- client entry module script
- route metadata used for transitions

## Hydration rules

- Server markup and client markup must stay deterministic.
- Avoid server/client branches inside render output.
- Do not compute unstable IDs with `Math.random()` or `Date.now()` during render.

## Related APIs

- [`createServer`](/docs/api/react-bun-ssr)
- [`useLoaderData`](/docs/api/react-bun-ssr-route)
- [`useRequestUrl`](/docs/api/react-bun-ssr-route)

## Next step

Add progressive delivery with [Streaming and Deferred](/docs/rendering/streaming-deferred).
