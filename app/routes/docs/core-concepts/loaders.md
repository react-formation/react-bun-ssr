---
title: Loaders and data flow
description: Server-side data loading model and how payload data reaches client hydration.
section: Core Concepts
order: 3
tags: loader,data
---

# Loaders and data flow

A `loader` runs for `GET/HEAD` page requests.

## Example

```tsx
import { useLoaderData } from "react-bun-ssr/route";

interface PostData {
  id: string;
  title: string;
}

export async function loader({ params }: { params: { id: string } }) {
  return {
    id: params.id,
    title: `Post ${params.id}`,
  } satisfies PostData;
}

export default function PostRoute() {
  const data = useLoaderData<PostData>();
  return <h1>{data.title}</h1>;
}
```

## Return values

- `Response` is passed through.
- `redirect()` result becomes an HTTP redirect.
- `routeError(status, data?)` throws a typed caught error for `CatchBoundary` / `NotFound` flows.
- `notFound(data?)` throws a typed caught 404.
- Plain values are serialized into the SSR payload and read with `useLoaderData()`.
- `defer({...})` enables streaming deferred keys with `Suspense` + `use()`.

## Deferred data streaming

```tsx
import { Suspense, use } from "react";
import { defer, useLoaderData } from "react-bun-ssr/route";

export function loader() {
  return defer({
    critical: "Product page",
    stats: fetch("https://example.com/stats").then(r => r.json()),
  });
}

function Stats(props: { data: Promise<{ views: number }> }) {
  const stats = use(props.data);
  return <p>Views: {stats.views}</p>;
}

export default function ProductRoute() {
  const data = useLoaderData<{
    critical: string;
    stats: Promise<{ views: number }>;
  }>();

  return (
    <>
      <h1>{data.critical}</h1>
      <Suspense fallback={<p>Loading stats…</p>}>
        <Stats data={data.stats} />
      </Suspense>
    </>
  );
}
```

## Context

Loaders receive URL, params, cookies, and mutable `locals`.
