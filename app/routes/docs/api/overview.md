---
title: API Overview
navTitle: Overview
description: Choose the right package entrypoint, understand the surface area, and jump from concepts to generated signatures quickly.
section: API
order: 1
kind: reference
tags: api,reference,entrypoints
---

# API Overview

The framework exposes two primary entrypoints.

## `react-bun-ssr`

Use the root package for:

- server startup
- config helpers
- shared response helpers
- deployment-facing runtime types

Go to [react-bun-ssr](/docs/api/react-bun-ssr).

## `react-bun-ssr/route`

Use the route entrypoint inside application routes for:

- loaders and actions
- route hooks
- client navigation
- TanStack-style route errors
- nested layout rendering through `Outlet`

Go to [react-bun-ssr/route](/docs/api/react-bun-ssr-route).

## Bun runtime mapping

Use [Bun Runtime APIs](/docs/api/bun-runtime-apis) when you want to understand which Bun-native APIs the framework leans on directly.

That page separates:

- public framework abstractions you will use in routes and deployment
- internal Bun integrations that power the framework but are not part of the route API

## Recommended reading path

- [Loaders](/docs/data/loaders)
- [Actions](/docs/data/actions)
- [Error Handling](/docs/data/error-handling)
- [Navigation](/docs/routing/navigation)

## What generated API pages provide

Generated API pages include:

- TypeScript signatures
- source file location
- a description for each symbol
- links back into the most relevant guide pages

## Next step

Start with [Bun Runtime APIs](/docs/api/bun-runtime-apis), then move into the generated [`react-bun-ssr`](/docs/api/react-bun-ssr) package page.
