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
    docs/
      getting-started/introduction.md
      _layout.tsx
      _sidebar.ts
    api/search.ts
framework/
```

## Notes

- `app/routes/api/**` defines resource routes.
- `app/routes/**/_layout.tsx` and `_middleware.ts` scope behavior to subtrees.
- Markdown docs are first-class routes: add new pages as `app/routes/docs/**/*.md`.
- `app/routes/docs/api/*.md` and `app/routes/docs/search-index.json` are machine-generated and checked in.
