---
title: Build artifacts
description: Output files produced by build and docs pipelines.
section: Tooling
order: 2
tags: dist,manifest
---

# Build artifacts

`rbssr build` writes:

- `dist/client/**` hashed browser assets
- `dist/manifest.json` route to asset mapping
- `dist/server/server.mjs` Bun production entry

Docs generation additionally writes:

- `docs/generated/api/*.md`
- `docs/generated/search-index.json`
