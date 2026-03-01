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

Each exported symbol now includes:

- purpose-oriented description
- direct links to concept pages with usage examples
- generated TypeScript signature and source path

Generation is deterministic and CI checks for stale artifacts.

Recent additions in `react-bun-ssr/route` include:

- `Link` for client-side transitions
- `useRouter` for programmatic navigation
- `Loading` route export support (typed in `RouteModule`)
- `routeError`, `notFound`, and `isRouteErrorResponse` for TanStack-style caught errors
- route lifecycle hooks via `RouteCatchContext` and `RouteErrorContext`
- deferred transition chunk types used by the runtime protocol
