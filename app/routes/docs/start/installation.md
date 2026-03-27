---
title: Installation and Setup
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
git clone git@github.com:react-formation/react-bun-ssr.git
cd react-bun-ssr
bun install
bun run docs:dev
```

That runs the documentation site built with the framework itself.

## What `rbssr init` gives you

- `package.json` with Bun scripts and runtime dependencies
- `tsconfig.json` with Bun-friendly TypeScript defaults
- `.gitignore` with starter ignore rules
- `app/root.tsx` as the document shell
- `app/root.module.css` with default starter styling
- `app/routes/` for file-based pages and APIs
- `app/public/` for static assets
- `rbssr.config.ts` for runtime configuration

## First files to verify

```text
package.json
tsconfig.json
.gitignore
app/
  root.tsx
  root.module.css
  routes/
    index.tsx
    api/
      health.ts
  middleware.ts
  public/
    favicon.svg
rbssr.config.ts
```

## Rules

- Bun `>= 1.3.10` is the baseline.
- The framework expects Bun for dev, build, and production runtime.
- Keep browser-hydrated route UI modules client-safe.
- Put Bun-only code in `*.server.ts` or `*.server.tsx` route companions and server-only route files.

## Related APIs

- [`defineConfig`](/docs/api/react-bun-ssr)
- [`FrameworkConfig`](/docs/api/react-bun-ssr)

## Next step

Build the first real page in [Quick Start](/docs/start/quick-start).
