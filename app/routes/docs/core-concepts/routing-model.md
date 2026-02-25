---
title: Routing model
description: File to URL mapping for static, dynamic, catch-all, and API routes.
section: Core Concepts
order: 1
tags: routing,dynamic
---

# Routing model

## File conventions

- `index.tsx` -> `/`
- `[id].tsx` -> `/:id`
- `[...slug].tsx` -> `/*slug`
- `guide.md` -> `/guide`
- `(group)` directories are ignored in URL mapping.

## Markdown routes (`.md`)

You can create page routes directly from markdown files under `app/routes`.

Example:

- `app/routes/getting-started.md` becomes `/getting-started`

Markdown routes are compiled into framework-generated route modules and rendered with SSR + hydration parity.

### How markdown routing works

1. Route scanning includes `.md` files as page routes.
2. Each markdown file is compiled to HTML with Bun markdown.
3. The framework generates an internal TSX wrapper module for that route.
4. Server render and client hydration both import the same generated wrapper module.

This means markdown routes behave like normal page routes for layouts, middleware, and route matching.

## Why `.mdx` is unsupported (for now)

`.mdx` route files are currently rejected with a clear error.
Use `.md` for native markdown routes, or a `.tsx` route module when you need JSX/components.

## API routes

Place handlers in `app/routes/api/**/*.ts` and export method-named functions (`GET`, `POST`, ...).
