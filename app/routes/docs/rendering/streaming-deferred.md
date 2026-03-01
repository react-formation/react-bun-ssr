---
title: Streaming and Deferred Data
navTitle: Streaming and Deferred
description: Stream full HTML documents and deferred loader chunks so pages can reveal data progressively.
section: Rendering
order: 2
kind: guide
tags: streaming,defer,suspense,html
---

# Streaming and Deferred Data

Streaming is no longer a future feature. HTML responses are streamed, and deferred loader keys can resolve after the first bytes leave the server.

## Minimal working example

```tsx
import { Suspense, use } from "react";
import { defer, useLoaderData, type Loader } from "react-bun-ssr/route";

export const loader: Loader = () => {
  return defer({
    pageTitle: "Task analytics",
    analytics: Promise.resolve({ completedToday: 14 }),
  });
};

function Analytics(props: { value: Promise<{ completedToday: number }> }) {
  const analytics = use(props.value);
  return <p>Completed today: {analytics.completedToday}</p>;
}

export default function AnalyticsPage() {
  const data = useLoaderData<{
    pageTitle: string;
    analytics: Promise<{ completedToday: number }>;
  }>();

  return (
    <main>
      <h1>{data.pageTitle}</h1>
      <Suspense fallback={<p>Loading analytics…</p>}>
        <Analytics value={data.analytics} />
      </Suspense>
    </main>
  );
}
```

## What streams

- the HTML document shell
- the initial route payload with deferred tokens
- deferred resolve/reject chunks
- transition payloads during client-side navigation

## Rules

- Deferred values must resolve to serializable data.
- Rejected deferred promises bubble to the nearest error boundary.
- Top-level keys only are supported in v1.

## Related APIs

- [`defer`](/docs/api/react-bun-ssr-route)
- [`DeferredLoaderResult`](/docs/api/react-bun-ssr-route)
- [`DeferredToken`](/docs/api/react-bun-ssr-route)

## Next step

Finish the rendering story with [Head and Meta](/docs/rendering/head-meta).
