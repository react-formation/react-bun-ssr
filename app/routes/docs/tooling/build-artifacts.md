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

- `app/routes/docs/api/*.md`
- `app/routes/docs/search-index.json`

## Go deeper with Bun docs

- [Bundler overview](https://bun.sh/docs/bundler)
- [TypeScript support](https://bun.sh/docs/runtime/typescript)
- [CLI reference](https://bun.sh/docs/cli)
