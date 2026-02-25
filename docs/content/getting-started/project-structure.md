---
title: Project structure
description: Default directory conventions for routes, middleware, public assets, and docs artifacts.
section: Getting Started
order: 4
tags: structure,routes
---

# Project structure

```text
app/
  root.tsx
  middleware.ts
  public/
  routes/
    index.tsx
    docs/[...slug].tsx
    api/search.ts
docs/
  content/
  generated/
  meta/
framework/
```

## Notes

- `app/routes/api/**` defines resource routes.
- `app/routes/**/_layout.tsx` and `_middleware.ts` scope behavior to subtrees.
- `docs/generated/**` is machine-generated and checked in.
