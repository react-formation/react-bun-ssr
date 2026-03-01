---
title: Overview
navTitle: Overview
description: Learn what react-bun-ssr is, why it is Bun-first, and how the Task Tracker example maps to the framework primitives.
section: Start
order: 1
kind: overview
tags: bun,ssr,react,overview
---

# Overview 

`react-bun-ssr` is a Bun-native SSR React framework for teams that want React ergonomics without leaving Bun's runtime, bundler, and server model.

## What you build with it

In this documentation set, the running example is a `Task Tracker` application:

- `/tasks` lists tasks from a loader.
- `/tasks/new` posts through an action.
- `/tasks/:id` shows route params, nested layouts, and metadata.
- `/api/tasks` exposes JSON from the same route tree.

That one app is enough to explain the framework without falling back to toy snippets.

## The shape of the framework

```text
app/
  root.tsx
  routes/
    index.tsx
    tasks/
      _layout.tsx
      index.tsx
      [id].tsx
      new.tsx
    api/
      tasks.ts
  public/
    logo.svg
rbssr.config.ts
```

## What is opinionated

- Routing is file-based.
- SSR is the default render model.
- Bun is the only runtime target.
- Client transitions are built around `Link` and `useRouter`.
- Markdown routes are first-class pages.

## What is not here

- React Server Components.
- Multi-runtime adapters.
- MDX as a route type.
- Static-site-only workflows.

## Why Bun-first matters

Because the framework is built around Bun, it can lean on Bun primitives directly for:

- server startup
- route bundling
- markdown rendering
- hashing and file I/O
- browser/client bundle generation

That keeps the runtime surface smaller than a Node-plus-plugin stack.

If you want the exact mapping between Bun-native APIs and framework behavior, read [Bun Runtime APIs](/docs/api/bun-runtime-apis).

## Start with these guides

- [Installation](/docs/start/installation)
- [Quick Start](/docs/start/quick-start)
- [File-Based Routing](/docs/routing/file-based-routing)
- [API Overview](/docs/api/overview)

## Related APIs

- [`createServer`](/docs/api/react-bun-ssr)
- [`defineConfig`](/docs/api/react-bun-ssr)
- [`RouteModule`](/docs/api/react-bun-ssr-route)

## Next step

Go to [Installation](/docs/start/installation) to get a local project running.
