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
- `(group)` directories are ignored in URL mapping.

## API routes

Place handlers in `app/routes/api/**/*.ts` and export method-named functions (`GET`, `POST`, ...).
