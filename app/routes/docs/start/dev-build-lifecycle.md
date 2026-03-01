---
title: Dev and Build Lifecycle
navTitle: Dev/Build Lifecycle
description: See how Bun hot reload, generated client entries, builds, and production startup differ across rbssr commands.
section: Start
order: 5
kind: reference
tags: dev,build,preview,lifecycle
---

# Dev and Build Lifecycle

The framework has two major operating modes: development with Bun-driven hot reload, and production with immutable build output.

## Command model

```bash
bun run dev
bun run build
bun run start
```

## Development

`bun run dev` now splits work between a launcher process, a Bun hot child, and a long-lived browser bundle watch.

- The launcher writes `.rbssr/generated/dev/entry.ts` and starts `bun --hot`.
- The hot child keeps SSR in the framework `fetch()` path.
- Generated client entries stay in `.rbssr/generated/client-entries` and are only regenerated when route topology changes.
- Browser bundles are built by one long-lived `bun build --watch` process and served from `/__rbssr/client/*`.
- Browser reloads use `/__rbssr/ws` instead of the old event stream.

## Production build

`bun run build` creates `dist/`:

- `dist/client/` for JS, CSS, and copied public assets
- `dist/manifest.json` for route asset lookup
- `dist/server/server.mjs` as the production startup entry

## Preview / start

`bun run start` loads the build manifest and starts the Bun HTTP server in production mode.

## Rules

- Dev mode is optimized around Bun hot reload and incremental browser rebuilds, not snapshot mirroring.
- Production mode expects the build manifest and built assets to exist.
- Production build and production start stay separate from the dev runtime.

## Related APIs

- [`createServer`](/docs/api/react-bun-ssr)
- [`startHttpServer`](/docs/api/react-bun-ssr)
- [`FrameworkConfig`](/docs/api/react-bun-ssr)

## Next step

Continue with [File-Based Routing](/docs/routing/file-based-routing).
