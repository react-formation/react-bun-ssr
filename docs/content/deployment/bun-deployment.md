---
title: Bun-only deployment
description: Production deployment model with Bun runtime and rbssr start.
section: Deployment
order: 1
tags: deploy,bun
---

# Bun-only deployment

1. `bun install --frozen-lockfile`
2. `bun run docs:build`
3. `bun run start`

Deploy environments must provide Bun runtime compatible with your lockfile and framework version.

## Go deeper with Bun docs

- [Bun in production](https://bun.sh/docs/runtime/production)
- [Deployment guides](https://bun.sh/guides)
- [Package manager (lockfile / install)](https://bun.sh/docs/pm/cli/install)
