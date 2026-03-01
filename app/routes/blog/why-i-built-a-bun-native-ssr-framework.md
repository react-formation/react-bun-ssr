---
title: Why I Built a Bun-Native SSR Framework as an Alternative to Next.js and Remix
description: Why I built react-bun-ssr as a Bun-native alternative to Next.js and Remix, what it already supports today, and what I plan to ship next.
section: Blog
author: gaudiauj
publishedAt: 2026-03-01
tags: bun,ssr,react,nextjs,remix,framework
---

I built `react-bun-ssr` because I wanted a serious SSR framework in the React ecosystem that does not start from Node assumptions and does not force every project into the shape of Next.js or Remix.

Next.js and Remix both matter. They pushed the ecosystem forward. But they should not be the only reference points when someone wants server-rendered React with a different runtime model, a smaller abstraction surface, or tighter control over the request pipeline.

That is the core reason this project exists: to build a credible Bun-native alternative in the world of SSR frameworks, with enough built-in structure to be useful and enough restraint to stay understandable.

## Why build another SSR framework?

I did not want to build a framework just to clone another framework with slightly different branding.

I wanted a stack that treats Bun as the primary runtime instead of as a compatibility target. That changes how routing, bundling, markdown support, file I/O, server startup, and deployment feel in practice.

It also creates room for a different tradeoff profile:

- a Bun-first runtime instead of a Node-first runtime with adapters
- file-based routing without bringing in a large plugin ecosystem immediately
- SSR, loaders, actions, middleware, and markdown routes in one coherent product surface
- a codebase that stays small enough to inspect and evolve directly

For teams and individual developers who want an alternative to Next.js and Remix, that matters. Competition in framework design is healthy. It creates better defaults, sharper ideas, and more honest tradeoffs.

## Why Bun?

The short version is that [Bun](https://bun.sh/) gives me the kind of runtime foundation I actually want to build on.

It is fast, but speed by itself is not the whole story. What matters more is the combination of runtime, bundler, file primitives, markdown support, and server APIs living in one system instead of being stitched together from separate layers.

That has shaped `react-bun-ssr` directly:

- the HTTP server path is Bun-native
- bundling stays inside Bun instead of introducing a separate build tool stack first
- markdown routes can compile through Bun primitives
- file I/O and hashing can use Bun utilities directly
- deployment stays simpler because the framework and runtime assumptions line up

That does not mean Bun is finished or perfect. It means the direction is right for this project. I would rather build around a runtime that is still improving quickly but already has the primitives I want than keep pretending Node is the only serious baseline for SSR framework design.

If you want the exact runtime mapping, read [Bun Runtime APIs](/docs/api/bun-runtime-apis).

## What react-bun-ssr already supports

The project already has a real core, not just a routing demo.

Today it includes:

- [file-based routing](/docs/routing/file-based-routing) for pages, API routes, dynamic params, and markdown routes
- [layouts and route groups](/docs/routing/layouts-and-groups) for shared UI without polluting the public URL
- [middleware](/docs/routing/middleware) for request-scoped auth, redirects, and locals before route handlers run
- [loaders](/docs/data/loaders) and actions for data fetching and mutation flows
- [streaming SSR and deferred data](/docs/rendering/streaming-deferred) so the first render and client transitions can progressively reveal data
- client-side transitions through `Link` and `useRouter`
- first-class markdown routes for docs and content pages
- a Bun-first deployment model documented in [Bun Deployment](/docs/deployment/bun-deployment)

That is the part I care about most: the framework is already useful enough to build the docs site with itself, and the product surface is getting more coherent instead of more accidental.

If you want to see the fastest path into the framework, start with [Quick Start](/docs/start/quick-start).

## What I want to build next

There is still a lot to improve, and I would rather say that clearly than pretend the framework is already complete.

The next areas I want to push are:

- caching, starting with a pragmatic SQLite or in-memory default
- deeper Bun API compatibility work, especially around cookies and routing internals
- CSRF protection as a first-class security story
- CSS-in-JS possibilities without sacrificing the current Bun-first design
- better tests and stronger regression coverage across runtime and docs flows
- S3 support and image optimization paths
- a more complete deployment guide for real-world hosting setups
- better accessibility and broader A11Y polish across the framework and site

That roadmap is intentionally practical. I am not trying to promise every possible platform feature at once. I want the framework to get better in the areas that affect real applications first.

## Benchmarking comes later

A full benchmark against TanStack, Next.js, and Remix is something I want to publish later, but only when it is honest and useful.

Benchmark work is easy to do badly. It is easy to cherry-pick scenarios, ignore warm-up effects, or compare unlike systems. I would rather wait until the framework is stable enough, the scenarios are defensible, and the measurements say something real.

When that work happens, the goal will be simple: understand where a Bun-native SSR framework actually benefits from its design, and where the tradeoffs are still visible.

## Closing

`react-bun-ssr` exists because I wanted a serious Bun-native alternative to Next.js and Remix in the SSR space.

If that is the same thing you have been looking for, start with the [docs](/docs), read the [Quick Start](/docs/start/quick-start), and check the code on [GitHub](https://github.com/react-formation/react-bun-ssr).
