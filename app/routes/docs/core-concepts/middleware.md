---
title: Middleware chain
description: Global and nested middleware execution ordering and short-circuit behavior.
section: Core Concepts
order: 5
tags: middleware,request
---

# Middleware chain

Middleware order is deterministic:

- global `app/middleware.ts`
- nested `app/routes/**/_middleware.ts` from parent to child
- optional route module middleware

Each middleware can return early or call `next()` and mutate response headers.

## Example

```ts
import type { Middleware } from "react-bun-ssr/route";

export const middleware: Middleware = async (ctx, next) => {
  if (!ctx.cookies.get("session")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const response = await next();
  response.headers.set("x-auth-checked", "true");
  return response;
};
```
