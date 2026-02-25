---
title: Dev/build/start lifecycle
description: How rbssr dev, build, and start work together in Bun runtime.
section: Getting Started
order: 5
tags: dev,build,start
---

# Dev/build/start lifecycle

## Development

`rbssr dev` watches app sources, rebuilds client entries, snapshots server modules, and sends SSE reload events.

## Build

`rbssr build` emits:

- `dist/client/**`
- `dist/manifest.json`
- `dist/server/server.mjs`

## Start

`rbssr start` runs the production server entry with build manifest wiring.
