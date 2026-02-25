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
- Plain values are serialized into the SSR payload and read with `useLoaderData()`.

## Context

Loaders receive URL, params, cookies, and mutable `locals`.
