---
title: Troubleshooting
description: Common hydration and dev-mode issues with concrete fixes.
section: Deployment
order: 3
tags: troubleshooting,hydration,dev
---

# Troubleshooting

## Hydration mismatch after edits

If server and client assets are out of sync, ensure dev snapshot rebuild completes and browser performs a reload after SSE `reload` event.

## Missing module from dev snapshots

If a route file cannot be imported from `.rbssr/dev/server-snapshots/*`, restart dev server and ensure snapshot root is cleaned only once on startup.

## Unexpected stale static assets

Production static files are cached by default:

- `/client/*-[hash].js|css`: long-lived immutable cache
- other static files: 1 hour cache

If you need different behavior, override with `headers` rules in `rbssr.config.ts`.

## Title children warning

Use a single string in `<title>` children. Example:

```tsx
<title>{`Page ${name}`}</title>
```
