---
title: API reference overview
description: How generated API docs are produced and where to find each exported contract.
section: API Reference
order: 1
tags: api,types,generation
---

# API reference overview

The API reference pages under `/docs/api/*` are generated from TypeScript exports in:

- `framework/runtime/index.ts`
- `framework/runtime/route-api.ts`

Generation is deterministic and CI checks for stale artifacts.
