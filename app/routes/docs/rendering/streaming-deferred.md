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

## How `defer()` fits into streaming

`defer()` is the loader API that turns streaming into a practical page pattern.

The first response contains:

- the full HTML document shell
- immediate loader values
- placeholder tokens for deferred keys

Then the server streams deferred settle chunks as each promise resolves or rejects. The client runtime revives those deferred keys into promises again, so the same route can hydrate and later transition without changing component code.

That is why the recommended consumption model is:

- `useLoaderData()` to read the loader object
- React `use()` to unwrap the deferred promise
- `Suspense` to define the loading boundary

## Choosing immediate vs deferred data

Split loader data by render priority:

- keep page title, summary counts, and primary shell data immediate
- defer slow tables, analytics, secondary panels, or related collections

For example, a task dashboard can render the title and task counts immediately, while a slower activity feed resolves later behind a `Suspense` boundary.

## Failure behavior

Deferred failures are not ignored.

- If a deferred promise rejects, the error bubbles to the nearest route error boundary.
- During client transitions, deferred settle events follow the same behavior as the initial document render.
- If the value is required for the whole page, it should not be deferred in the first place.

## Rules

- Deferred values must resolve to serializable data.
- Rejected deferred promises bubble to the nearest error boundary.
- Top-level keys only are supported in v1.

## Related guides

- [Loaders](/docs/data/loaders)
- [Error Handling](/docs/data/error-handling)

## Related APIs

- [`defer`](/docs/api/react-bun-ssr-route)
- [`DeferredLoaderResult`](/docs/api/react-bun-ssr-route)
- [`DeferredToken`](/docs/api/react-bun-ssr-route)

## Next step

Finish the rendering story with [Head and Meta](/docs/rendering/head-meta).
