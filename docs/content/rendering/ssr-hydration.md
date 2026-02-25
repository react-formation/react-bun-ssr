---
title: SSR and hydration
description: Request-time renderToString output and hydrateRoot behavior.
section: Rendering
order: 1
tags: ssr,hydration
---

# SSR and hydration

The server renders HTML with `renderToString` and embeds a serialized route payload.

The client bootstraps with `hydrateRoot` and reuses the SSR tree.

## Example

```tsx
import { useLoaderData } from "react-bun-ssr/route";

export function loader() {
  return {
    renderedAt: "2026-02-25T00:00:00.000Z",
  };
}

export default function TimeRoute() {
  const data = useLoaderData<{ renderedAt: string }>();
  return <p>Rendered at: {data.renderedAt}</p>;
}
```

## Hydration mismatch prevention

Keep server and client output deterministic for first render. Avoid random values and time-dependent strings unless they are included in payload data.
