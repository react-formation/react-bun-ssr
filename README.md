# react-bun-ssr

`react-bun-ssr` is a Bun-native SSR React framework with file-based routing, loaders, actions, middleware, streaming, soft navigation, and first-class markdown routes.

- Documentation: https://react-bun-ssr.fly.dev/docs
- API reference: https://react-bun-ssr.fly.dev/docs/api/overview
- Blog: https://react-bun-ssr.fly.dev/blog
- Repository: https://github.com/react-formation/react-bun-ssr

## Why react-bun-ssr?

`react-bun-ssr` exists for teams that want server-rendered React without starting from Node-first assumptions.

It is designed around Bun's runtime, server, bundler, markdown support, and file APIs instead of treating Bun as a compatibility layer. The goal is to stay small enough to understand, but complete enough to use seriously for real SSR applications. The documentation site in this repository is built with the framework itself, so the framework is continuously exercised by its own product surface.

## What it includes

- [File-based routing](/docs/routing/file-based-routing) for pages, APIs, dynamic params, and markdown routes
- [Layouts, route groups, and middleware](/docs/routing/layouts-and-groups) with a dedicated [middleware pipeline](/docs/routing/middleware)
- [Loaders and actions](/docs/data/loaders) for explicit data fetching and mutation flow
- [Streaming SSR and deferred data](/docs/rendering/streaming-deferred)
- Soft client transitions with [`Link` and `useRouter`](/docs/routing/navigation)
- [Bun-first runtime, build, and deployment model](/docs/deployment/bun-deployment)
- [CSS Modules and static asset support](/docs/styling/css-modules)
- [Response header config and static caching defaults](/docs/deployment/configuration)

## Installation

Prerequisites:

- Bun `>= 1.3.10`
- `rbssr` available on PATH in the workflow you use to start a new app

Minimal setup:

```bash
bun --version
mkdir my-app
cd my-app
rbssr init
bun install
bun run dev
```

Open:

```text
http://127.0.0.1:3000
```

For the full setup walkthrough, read the installation guide:

- https://react-bun-ssr.fly.dev/docs/start/installation

## What `rbssr init` gives you

`rbssr init` scaffolds a small Bun-first SSR app:

```text
app/
  root.tsx
  middleware.ts
  routes/
    index.tsx
    api/
      health.ts
rbssr.config.ts
```

- `app/root.tsx`: document shell and top-level layout
- `app/middleware.ts`: global request pipeline hook
- `app/routes/index.tsx`: first SSR page route
- `app/routes/api/health.ts`: first API route
- `rbssr.config.ts`: runtime configuration entrypoint

The quickest follow-up is:

- https://react-bun-ssr.fly.dev/docs/start/quick-start

## How it works

### File-based routing

Routes live under `app/routes`. Page routes, API routes, dynamic params, and markdown routes all share one route tree. Files like `_layout` and `_middleware` participate in routing and request flow without becoming public URL segments.

Read more:

- https://react-bun-ssr.fly.dev/docs/routing/file-based-routing

### Request pipeline

For a page request, the framework resolves the matching route, runs global and nested middleware, executes the matched loader or action, and then renders an HTML response or returns a direct `Response` when the route short-circuits. API routes use the same route tree and middleware model, but return handler responses instead of page HTML.

Read more:

- https://react-bun-ssr.fly.dev/docs/routing/middleware
- https://react-bun-ssr.fly.dev/docs/data/loaders

### Rendering model

SSR is the default model. HTML responses stream, deferred loader data is supported, and soft client transitions are handled through `Link` and `useRouter`. The docs site in this repository uses the same routing, rendering, markdown, and transition model that framework users get.

Read more:

- https://react-bun-ssr.fly.dev/docs/rendering/streaming-deferred
- https://react-bun-ssr.fly.dev/docs/routing/navigation

### Bun-first runtime

Bun provides the runtime, server, bundler, markdown support, and file APIs that the framework is built around. `react-bun-ssr` is designed to use those primitives directly instead of layering itself on top of a Node-first base.

Read more:

- https://react-bun-ssr.fly.dev/docs/api/bun-runtime-apis

## Core commands

Framework commands:

- `rbssr init`: scaffold a new app in the current directory
- `rbssr dev`: start the Bun dev server
- `rbssr build`: create production output in `dist/`
- `rbssr start`: run the built app in production mode

Repository maintenance commands:

- `bun run docs:dev`
- `bun run docs:check`
- `bun run docs:build`
- `bun run test`
- `bun run typecheck`

CLI reference:

- https://react-bun-ssr.fly.dev/docs/tooling/cli

## Working on this repository

This repository contains both the framework and the official docs site built with it.

```bash
git clone git@github.com:react-formation/react-bun-ssr.git
cd react-bun-ssr
bun install
bun run docs:dev
```

That starts the docs site locally using the framework itself.

## Project layout

- `framework/`: runtime, renderer, route handling, build tooling, and CLI internals
- `bin/rbssr.ts`: CLI entrypoint
- `app/`: docs site routes, layouts, middleware, blog, and styles
- `app/routes/docs/**/*.md`: authored documentation pages
- `app/routes/blog/*.md`: authored blog posts
- `scripts/`: generators and validation scripts
- `tests/`: unit and integration tests
- `e2e/`: Playwright end-to-end tests

## Contributing

Contributions should keep framework behavior, docs, tests, and generated artifacts aligned. For local setup, workflow, validation requirements, and generated-file policy, read [CONTRIBUTING.md](./CONTRIBUTING.md).

## Deploying

Fly.io deployment support is already documented and used by this project.

Happy path:

```bash
fly auth login
fly deploy
```

Full deployment docs:

- https://react-bun-ssr.fly.dev/docs/deployment/bun-deployment
- https://react-bun-ssr.fly.dev/docs/deployment/configuration
- https://react-bun-ssr.fly.dev/docs/deployment/troubleshooting
