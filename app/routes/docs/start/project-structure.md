---
title: Project Structure
navTitle: Project Structure
description: Understand how the framework maps app, public, dist, and generated directories so your project stays predictable.
section: Start
order: 4
kind: reference
tags: structure,files,generated
---

# Project Structure

A `react-bun-ssr` app stays easier to reason about when you treat four directories differently: authored app code, static assets, generated files, and build output.

## Reference layout

```text
app/
  root.tsx
  root.server.tsx
  middleware.server.ts
  public/
    favicon.svg
    brand/logo.svg
  routes/
    index.tsx
    index.server.tsx
    tasks/
      _layout.tsx
      _layout.server.tsx
      index.tsx
      [id].tsx
      new.tsx
    api/
      tasks.server.ts
framework/
  runtime/
.rbssr/
dist/
rbssr.config.ts
```

## What belongs where

### `app/`

Author everything you own directly:

- root document shell
- route modules
- colocated private route files like `_card.tsx`
- route middleware
- CSS Modules
- public assets

### `.rbssr/`

This is framework-generated and should be treated as disposable:

- generated dev entrypoints
- generated markdown wrappers
- generated client entries
- router projection files

### `dist/`

Production build output:

- client bundles
- manifest
- production server entry

## How route files map to URLs

- `app/routes/index.tsx` -> `/`
- `app/routes/tasks/index.tsx` -> `/tasks`
- `app/routes/tasks/[id].tsx` -> `/tasks/:id`
- `app/routes/api/tasks.server.ts` -> `/api/tasks`
- `app/routes/docs/start/overview.md` -> `/docs/start/overview`

## Rules

- Do not commit `.rbssr/`.
- Treat `dist/` as build output, not source.
- Files under `app/routes` that start with `_` are useful for colocation and do not create routes, except `_layout` and `_middleware`.
- Keep browser-facing route modules client-safe.
- Put Bun-only logic in `*.server.ts` / `*.server.tsx` route companions and server-only route files.

## Related APIs

- [`BuildManifest`](/docs/api/react-bun-ssr)
- [`BuildRouteAsset`](/docs/api/react-bun-ssr)

## Next step

Move to [Dev/Build Lifecycle](/docs/start/dev-build-lifecycle) to see how those directories change across commands.
