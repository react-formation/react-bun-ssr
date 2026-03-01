---
title: Build Output
navTitle: Build Output
description: Inspect client assets, manifest data, copied public files, and the production server entry emitted by rbssr build.
section: Tooling
order: 4
kind: reference
tags: build,manifest,dist
---

# Build Output

`rbssr build` produces a `dist/` directory that is ready to run under Bun.

## Typical output

```text
dist/
  client/
    *.js
    *.css
    favicon.svg
  manifest.json
  server/
    server.mjs
```

## Why the manifest exists

The server needs to know which client script and CSS files belong to each route so it can inject the right assets into the streamed document.

## Rules

- Treat `manifest.json` as generated source of truth.
- Hashed client bundles are long-lived and immutable in production.
- Public files are copied into `dist/client` during the build.

## Related APIs

- [`BuildManifest`](/docs/api/react-bun-ssr)
- [`BuildRouteAsset`](/docs/api/react-bun-ssr)

## Next step

Deploy the built app with [Bun Deployment](/docs/deployment/bun-deployment).
