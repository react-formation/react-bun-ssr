---
title: Installation
navTitle: Installation
description: Install Bun, prepare a project directory, and boot the framework with a minimal Bun-first setup.
section: Start
order: 2
kind: guide
tags: install,bun,setup
---

# Installation

This page gets a fresh `Task Tracker` workspace to the point where you can start writing route files.

## Minimal setup

```bash
bun --version
mkdir task-tracker
cd task-tracker
rbssr init
bun install
bun run dev
```

Open `http://127.0.0.1:3000` after the dev server starts.

## If you are working from this repository

```bash
git clone git@github.com:gaudiauj/react-bun-ssr.git
cd react-bun-ssr
bun install
bun run docs:dev
```

That runs the documentation site built with the framework itself.

## What `rbssr init` gives you

- `app/root.tsx` as the document shell
- `app/routes/` for file-based pages and APIs
- `app/public/` for static assets
- `rbssr.config.ts` for runtime configuration

## First files to verify

```text
app/
  root.tsx
  routes/
    index.tsx
  public/
    favicon.svg
rbssr.config.ts
```

## Rules

- Bun `>= 1.3.10` is the baseline.
- The framework expects Bun for dev, build, and production runtime.
- Route code that also hydrates in the browser should avoid top-level server-only imports.

## Related APIs

- [`defineConfig`](/docs/api/react-bun-ssr)
- [`FrameworkConfig`](/docs/api/react-bun-ssr)

## Next step

Build the first real page in [Quick Start](/docs/start/quick-start).
