---
title: CLI
navTitle: CLI
description: Use rbssr commands to initialize, develop, build, and preview a Bun-native SSR application.
section: Tooling
order: 2
kind: reference
tags: cli,rbssr,commands
---

# CLI

The `rbssr` CLI is intentionally small. Each command maps directly to a framework lifecycle step.

## Commands

```bash
rbssr init
rbssr dev
rbssr build
rbssr start
```

## What they do

- `init` scaffolds a new app in the current directory.
- `dev` starts the Bun dev launcher, hot child, WebSocket reload channel, and browser bundle watch.
- `build` creates `dist/`.
- `start` runs the built app in production mode.

## Rules

- Run `init` in an empty directory unless you intentionally want to merge into existing files.
- `build` expects route scanning and client entry generation to succeed first.
- `start` should point at built assets, not live source files.

## Related APIs

- [`FrameworkConfig`](/docs/api/react-bun-ssr)
- [`defineConfig`](/docs/api/react-bun-ssr)

## Next step

Add confidence with the testing approach in [Testing](/docs/tooling/testing).
