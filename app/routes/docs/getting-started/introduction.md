---
title: Introduction
description: What react-bun-ssr is, what it includes in v1, and the Bun-only design boundary.
section: Getting Started
order: 1
tags: intro,ssr,bun
---

# Introduction

`react-bun-ssr` is a Bun-native SSR React framework with file-based routing, route data primitives, middleware, and a built-in CLI.

## What is in v1

- SSR rendering with client hydration.
- Route module conventions (`loader`, `action`, `ErrorBoundary`, `NotFound`).
- File-based page and API routes under one Bun server.
- Bun build pipeline and route asset manifest.

## What is intentionally out of scope

- React Server Components.
- Streaming SSR.
- Edge/runtime adapters outside Bun.
- ISR/SSG workflows.
