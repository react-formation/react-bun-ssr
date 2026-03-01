---
title: Dev and Build Lifecycle
navTitle: Dev/Build Lifecycle
description: See how dev snapshots, generated client entries, builds, and production startup differ across rbssr commands.
section: Start
order: 5
kind: reference
tags: dev,build,preview,lifecycle
---

# Dev and Build Lifecycle

The framework has two major operating modes: development with rebuildable snapshots, and production with immutable build output.

## Command model

```bash
bun run dev
bun run build
bun run start
```

## Development

`bun run dev` does more than watch route files.

- It mirrors server modules into `.rbssr/dev/server-snapshots`.
- It regenerates client entries under `.rbssr/generated/client-entries`.
- It rebuilds route assets only when the file signature changes.
- It serves client bundles from `/.rbssr/dev/client`.

## Production build

`bun run build` creates `dist/`:

- `dist/client/` for JS, CSS, and copied public assets
- `dist/manifest.json` for route asset lookup
- `dist/server/server.mjs` as the production startup entry

## Preview / start

`bun run start` loads the build manifest and starts the Bun HTTP server in production mode.

## Rules

- Dev mode is optimized for rebuild correctness, not production parity at the file-path level.
- Production mode expects the build manifest and built assets to exist.
- File changes outside `app/` that are imported by route modules must still be mirrored into dev snapshots.

## Related APIs

- [`createServer`](/docs/api/react-bun-ssr)
- [`startHttpServer`](/docs/api/react-bun-ssr)
- [`FrameworkConfig`](/docs/api/react-bun-ssr)

## Next step

Continue with [File-Based Routing](/docs/routing/file-based-routing).
