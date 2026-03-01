---
title: Dev Server
navTitle: Dev Server
description: Understand watch behavior, rebuild signatures, transition endpoints, and dev-only reload semantics.
section: Tooling
order: 1
kind: reference
tags: dev,watch,reload,transitions
---

# Dev Server

`bun run dev` is designed for correctness first. It rebuilds when the route signature changes and keeps client transitions working against fresh payloads.

## What the dev server owns

- file watching through Bun-friendly dev orchestration
- route scanning and generated client entries
- dev client bundles under `/.rbssr/dev/client`
- internal endpoints like `/__rbssr/transition`
- document reload notifications when the rebuild version changes

## Rules

- Dev responses stay non-cacheable.
- Generated files are written under `.rbssr/` so they do not pollute your source tree.
- A file change should create one version bump, not a reload loop.

## Related APIs

- [`createServer`](/docs/api/react-bun-ssr)
- [`useRouter`](/docs/api/react-bun-ssr-route)

## Next step

Use [CLI](/docs/tooling/cli) as the command reference.
