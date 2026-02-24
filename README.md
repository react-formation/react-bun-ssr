# react-bun-ssr

TypeScript-only, Bun-native React SSR framework with:

- File-based routing.
- Route loaders and actions.
- SSR + hydration.
- Global and nested middleware.
- Route-level `ErrorBoundary` and `NotFound`.
- Built-in CLI (`rbssr`).

## Quick start

Install dependencies:

```bash
bun install
```

Run development server:

```bash
bun dev
```

Build for production:

```bash
bun build
```

Start production server:

```bash
bun start
```

## CLI

```bash
rbssr init [--force]
rbssr dev
rbssr build
rbssr start
rbssr typecheck
rbssr test [bun-test-args]
```

## Framework conventions

```text
app/
  root.tsx
  middleware.ts               # optional
  public/
  routes/
    _middleware.ts            # optional
    _layout.tsx               # optional
    index.tsx
    posts/[id].tsx
    api/hello.ts
```

Routing rules:

- `index.tsx` -> index route.
- `[id].tsx` -> dynamic route param.
- `[...slug].tsx` -> catch-all.
- `(group)` directories are ignored in URL path.
- `api/**/*.ts` files are API/resource routes.

Route module exports:

- Required: `default` React component.
- Optional: `loader`, `action`, `middleware`, `head`, `meta`, `ErrorBoundary`, `NotFound`.

## Runtime API

```ts
import { createServer, defineConfig } from "react-bun-ssr";
import {
  Outlet,
  json,
  redirect,
  useLoaderData,
  useParams,
} from "react-bun-ssr/route";
```

## Build output

`rbssr build` writes:

- `dist/client/**`
- `dist/manifest.json`
- `dist/server/server.mjs`

## Testing

```bash
bun run test:unit
bun run test:integration
bun run test:e2e
```

`test:e2e` starts `bun run dev` automatically via Playwright `webServer`.
