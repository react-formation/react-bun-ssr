---
title: Bun Runtime APIs Used by react-bun-ssr
navTitle: Bun Runtime APIs
description: Map the Bun-native APIs used by the framework to the public framework surface and official Bun documentation.
section: API
order: 2
kind: reference
tags: bun,api,runtime,reference
---

# Bun Runtime APIs Used by react-bun-ssr

This page maps the Bun-native APIs used by `react-bun-ssr` to the framework surface you interact with in routes, config, deployment, and generated docs.

## How to use this page

Use this page when you need to answer one of these questions quickly:

- Which Bun runtime primitive powers a framework feature?
- Is this Bun API something application code should care about directly, or is it internal?
- Where is the framework intentionally wrapping Bun instead of exposing Bun objects directly?

Each section calls out:

- the Bun API involved
- where the framework uses it
- whether it is `Framework-facing` or `Internal-only`
- official Bun documentation
- the most relevant framework docs entrypoint

## HTTP server runtime

**Bun API:** `Bun.serve()`

**Framework usage:** `react-bun-ssr` starts its production and development HTTP server on top of Bun’s native server runtime. The public entrypoints that matter here are [`createServer`](/docs/api/react-bun-ssr) and [`startHttpServer`](/docs/api/react-bun-ssr).

**Classification:** `Framework-facing`

When you deploy the framework, you are still deploying a Bun server. The framework provides the request handler and document/render pipeline, but the actual HTTP runtime is Bun.

Official Bun docs:

- [Bun APIs](https://bun.com/docs/runtime/bun-apis)
- [Common HTTP server usage](https://bun.com/docs/guides/http/server)

Framework docs:

- [Bun Deployment](/docs/deployment/bun-deployment)
- [react-bun-ssr API](/docs/api/react-bun-ssr)

## Cookies

**Bun APIs:** `Bun.Cookie`, `Bun.CookieMap`

**Framework usage:** the framework parses cookies into `ctx.cookies`, but it does **not** currently expose Bun’s `CookieMap` directly. Public route contexts expose a normalized `Map<string, string>`.

**Classification:** `Framework-facing`

This distinction matters:

- Bun’s native HTTP server can expose cookie helpers like `req.cookies` backed by `CookieMap`
- `react-bun-ssr` currently exposes `cookies` as a framework abstraction over cookie parsing
- application route code should treat `ctx.cookies` as `Map<string, string>`, not as `Bun.CookieMap`

```tsx
import type { LoaderContext } from "react-bun-ssr/route";

export async function loader({ cookies }: LoaderContext) {
  const session = cookies.get("session");
  return { authenticated: Boolean(session) };
}
```

Do not document or expect a framework `cookies()` helper here, because it does not exist in this project.

Official Bun docs:

- [Cookies](https://bun.com/docs/api/cookie)
- [HTTP server cookies](https://bun.com/docs/runtime/http/cookies)

Framework docs:

- [Loaders](/docs/data/loaders)
- [react-bun-ssr/route API](/docs/api/react-bun-ssr-route)

## Markdown rendering

**Bun API:** `Bun.markdown`

**Framework usage:** markdown route compilation and docs-page HTML generation rely on Bun’s markdown support. The framework then adds its own wrapper/module generation and heading ID handling on top of that.

**Classification:** `Framework-facing`

This is why `.md` routes can stay first-class without bringing in a separate markdown/MDX compiler stack.

Official Bun docs:

- [Bun APIs](https://bun.com/docs/runtime/bun-apis)

Framework docs:

- [Overview](/docs/start/overview)
- [File-Based Routing](/docs/routing/file-based-routing)

## File I/O and static assets

**Bun APIs:** `Bun.file`, `Bun.write`

**Framework usage:** the framework uses Bun-native file APIs for generated docs artifacts, runtime file reads, build output, and static asset handling paths.

**Classification:** `Framework-facing`

These APIs show up in two ways:

- directly in internal scripts and generators
- indirectly in the production/runtime behavior you see through static asset serving and build output

Official Bun docs:

- [File I/O](https://bun.com/docs/api/file-io)

Framework docs:

- [Public Assets](/docs/styling/public-assets)
- [Build Output](/docs/tooling/build-output)

## Build and bundling

**Bun API:** `Bun.build`

**Framework usage:** route modules and client entries are bundled through Bun’s build pipeline.

**Classification:** `Internal-only`

This is core to framework implementation, but it is not a day-to-day route API. Most users only need to care about it when debugging build output, deployment differences, or bundle behavior.

Official Bun docs:

- [Bundler](https://bun.com/docs/bundler)

Framework docs:

- [Build Output](/docs/tooling/build-output)
- [Bun Deployment](/docs/deployment/bun-deployment)

## Routing internals

**Bun API:** `Bun.FileSystemRouter`

**Framework usage:** the framework uses Bun’s file-system router internally as the authoritative matcher after projecting framework route conventions into a Bun-compatible route tree.

**Classification:** `Internal-only`

Application route authors do not interact with `Bun.FileSystemRouter` directly, but it matters for understanding why routing behavior stays Bun-native even though the framework supports conventions Bun does not model directly on its own.

Official Bun docs:

- [File System Router](https://bun.com/docs/runtime/file-system-router)

Framework docs:

- [File-Based Routing](/docs/routing/file-based-routing)

## Bun utilities adopted in the framework

The framework also leans on Bun runtime utilities where they make the code smaller, safer, or more deterministic.

**Classification:** mixed, but mostly `Internal-only`

- `Bun.escapeHTML()` for HTML-safe rendering paths and markdown heading IDs
- `Bun.inspect()` for better runtime diagnostics
- `Bun.pathToFileURL()` and `Bun.fileURLToPath()` for module loading and file URL conversion
- `Bun.Glob` for scanning docs and runtime/build inputs
- `Bun.CryptoHasher` for stable hashes
- `Bun.randomUUIDv7()` for temp directory naming
- `Bun.spawnSync()` for POSIX helper commands used by internal tooling

Official Bun docs:

- [Bun APIs](https://bun.com/docs/runtime/bun-apis)
- [Escape an HTML string](https://bun.com/docs/guides/util/escape-html)
- [Glob](https://bun.com/docs/runtime/glob)

Framework docs:

- [Overview](/docs/start/overview)
- [Dev Server](/docs/tooling/dev-server)

## Internal-only appendix

| Bun API | Used in | Why | Public or internal | Bun docs |
| --- | --- | --- | --- | --- |
| `Bun.build` | route/client bundling | Build route modules and browser assets | Internal-only | [Bundler](https://bun.com/docs/bundler) |
| `Bun.FileSystemRouter` | runtime route matching | Match projected framework routes with Bun-native routing | Internal-only | [File System Router](https://bun.com/docs/runtime/file-system-router) |
| `Bun.Glob` | docs/runtime scanning | Find route files, docs files, and source inputs efficiently | Internal-only | [Glob](https://bun.com/docs/runtime/glob) |
| `Bun.CryptoHasher` | hashing helpers | Produce deterministic short hashes | Internal-only | [Bun APIs](https://bun.com/docs/runtime/bun-apis) |
| `Bun.randomUUIDv7()` | temp directories | Generate stable, unique temp-path suffixes | Internal-only | [Bun APIs](https://bun.com/docs/runtime/bun-apis) |
| `Bun.spawnSync()` | internal POSIX ops | Run small helper commands without adding Node process wrappers | Internal-only | [Bun APIs](https://bun.com/docs/runtime/bun-apis) |
