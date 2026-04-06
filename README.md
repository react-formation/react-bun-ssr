# react-bun-ssr

[![npm version](https://img.shields.io/npm/v/react-bun-ssr)](https://www.npmjs.com/package/react-bun-ssr)
[![CI](https://github.com/react-formation/react-bun-ssr/actions/workflows/ci.yml/badge.svg)](https://github.com/react-formation/react-bun-ssr/actions/workflows/ci.yml)

`react-bun-ssr` is a Bun-native SSR React framework with file-based routing, loaders, actions, middleware, streaming, soft navigation, and first-class markdown routes.

> **Stability: Experimental (early alpha).**
> Expect breaking changes across minor releases while core APIs and ergonomics are still being shaped.

- Documentation: https://react-bun-ssr.dev/docs
- API reference: https://react-bun-ssr.dev/docs/api/overview
- Blog: https://react-bun-ssr.dev/blog
- Changelog: [CHANGELOG.md](./CHANGELOG.md)
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

- https://react-bun-ssr.dev/docs/start/installation

## What `rbssr init` gives you

`rbssr init` scaffolds a small Bun-first SSR app:

```text
package.json
tsconfig.json
.gitignore
app/
  root.tsx
  root.module.css
  middleware.ts
  public/
    favicon.svg
  routes/
    index.tsx
    api/
      health.ts
rbssr.config.ts
```

- `package.json`: Bun scripts and framework/runtime dependencies
- `tsconfig.json`: starter TypeScript config for Bun + JSX
- `.gitignore`: minimal app-level ignore rules
- `app/root.tsx`: document shell and top-level layout
- `app/root.module.css`: starter CSS Module for layout and base presentation
- `app/middleware.ts`: global request pipeline hook
- `app/public/favicon.svg`: starter public asset
- `app/routes/index.tsx`: first SSR page route
- `app/routes/api/health.ts`: first API route
- `rbssr.config.ts`: runtime configuration entrypoint

The quickest follow-up is:

- https://react-bun-ssr.dev/docs/start/quick-start

## How it works

### File-based routing

Routes live under `app/routes`. Page routes, API routes, dynamic params, and markdown routes all share one route tree. Files like `_layout` and `_middleware` participate in routing and request flow without becoming public URL segments.

Read more:

- https://react-bun-ssr.dev/docs/routing/file-based-routing

### Request pipeline

For a page request, the framework resolves the matching route, runs global and nested middleware, executes the matched loader or action, and then renders an HTML response or returns a direct `Response` when the route short-circuits. API routes use the same route tree and middleware model, but return handler responses instead of page HTML.

Under the hood, page HTML, API, internal action, and internal transition requests now share the same runtime request boundary, which keeps middleware, redirects, and response finalization behavior aligned across request kinds.

Read more:

- https://react-bun-ssr.dev/docs/routing/middleware
- https://react-bun-ssr.dev/docs/data/loaders

### Actions with React `useActionState`

Page mutations use React 19 form actions (`useActionState`) with an explicit route stub:

```tsx
// app/routes/login.tsx
import { useActionState } from "react";
import { createRouteAction } from "react-bun-ssr/route";

type LoginState = { error?: string };
export const action = createRouteAction<LoginState>();

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction}>
      {state.error ? <p>{state.error}</p> : null}
      <button disabled={pending}>Sign in</button>
    </form>
  );
}
```

```tsx
// app/routes/login.server.tsx
import { redirect } from "react-bun-ssr";
import type { Action } from "react-bun-ssr/route";

export const action: Action = async (ctx) => {
  const email = String(ctx.formData?.get("email") ?? "").trim();
  if (!email) return { error: "Email is required" };
  return redirect("/dashboard");
};
```

`createRouteAction` is the preferred pattern. `useRouteAction` remains available for backward compatibility.

### Rendering model

SSR is the default model. HTML responses stream, deferred loader data is supported, and soft client transitions are handled through `Link` and `useRouter`. The docs site in this repository uses the same routing, rendering, markdown, and transition model that framework users get.

Read more:

- https://react-bun-ssr.dev/docs/rendering/streaming-deferred
- https://react-bun-ssr.dev/docs/routing/navigation

### Bun-first runtime

Bun provides the runtime, server, bundler, markdown support, and file APIs that the framework is built around. `react-bun-ssr` is designed to use those primitives directly instead of layering itself on top of a Node-first base.

Read more:

- https://react-bun-ssr.dev/docs/api/bun-runtime-apis

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

- https://react-bun-ssr.dev/docs/tooling/cli

## Working on this repository

This repository contains both the framework and the official docs site built with it.

```bash
git clone git@github.com:react-formation/react-bun-ssr.git
cd react-bun-ssr
bun link
bun install
bun run docs:dev
```

That starts the docs site locally using the framework itself.

Dependency ownership is split intentionally:

- the repo-root `package.json` is the published framework manifest
- [`app/package.json`](/Users/react-formation/code/my-app/app/package.json) owns docs-app runtime dependencies

Contributors should still use the repo-root commands; the workspace split is there to keep npm package metadata accurate, not to change the day-to-day workflow.

## Project layout

- `framework/`: runtime, renderer, route handling, build tooling, and CLI internals
- `bin/rbssr.ts`: CLI entrypoint
- `app/`: docs site routes, layouts, middleware, blog, and styles
- `app/package.json`: private docs-app dependency manifest
- `app/routes/docs/**/*.md`: authored documentation pages
- `app/routes/blog/*.md`: authored blog posts
- `scripts/`: generators and validation scripts
- `tests/framework/`: framework runtime, CLI, build, unit/integration, and framework Playwright tests
- `tests/docs-app/`: docs site, blog, analytics, and docs-app Playwright tests

## Contributing

Contributions should keep framework behavior, docs, tests, and generated artifacts aligned. For local setup, workflow, validation requirements, and generated-file policy, read [CONTRIBUTING.md](./CONTRIBUTING.md).

## Release and deploy

- Pushes to `main` run the main-branch CI gate and deploy automatically to Fly.io.
- Tags like `v0.1.1-rc.0` publish prereleases to npm under `rc`.
- Tags like `v0.1.1` publish stable releases to npm under `latest`.
- The release workflow derives the published package version from the Git tag and rewrites `package.json` in the release job before publishing.
- npm publishing uses trusted publishing with GitHub OIDC instead of an `NPM_TOKEN`.
- npm package settings must have a trusted publisher configured for `react-formation / react-bun-ssr / release.yml`.
