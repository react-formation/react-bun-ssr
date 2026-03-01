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
  middleware.ts
  public/
    favicon.svg
    brand/logo.svg
  routes/
    index.tsx
    tasks/
      _layout.tsx
      index.tsx
      [id].tsx
      new.tsx
    api/
      tasks.ts
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
- route middleware
- CSS Modules
- public assets

### `.rbssr/`

This is framework-generated and should be treated as disposable:

- dev snapshots
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
- `app/routes/api/tasks.ts` -> `/api/tasks`
- `app/routes/docs/start/overview.md` -> `/docs/start/overview`

## Rules

- Do not commit `.rbssr/`.
- Treat `dist/` as build output, not source.
- Keep server-only helpers out of browser-hydrated route modules unless they are imported dynamically inside loaders/actions.

## Related APIs

- [`BuildManifest`](/docs/api/react-bun-ssr)
- [`BuildRouteAsset`](/docs/api/react-bun-ssr)

## Next step

Move to [Dev/Build Lifecycle](/docs/start/dev-build-lifecycle) to see how those directories change across commands.
