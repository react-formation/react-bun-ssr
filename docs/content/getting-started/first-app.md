---
title: First app
description: Minimal first route with SSR loader data and client hydration behavior.
section: Getting Started
order: 3
tags: starter,loader
---

# First app

Create `app/root.tsx` and `app/routes/index.tsx`.

## Root shell

```tsx
import { Outlet } from "react-bun-ssr/route";

export default function Root() {
  return <Outlet />;
}
```

## Index route

```tsx
import { useLoaderData } from "react-bun-ssr/route";

export function loader() {
  return { message: "hello" };
}

export default function Index() {
  const data = useLoaderData<{ message: string }>();
  return <h1>{data.message}</h1>;
}
```
