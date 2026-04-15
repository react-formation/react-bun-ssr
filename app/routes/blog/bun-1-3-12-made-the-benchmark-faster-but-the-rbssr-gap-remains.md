---
title: Bun 1.3.12 Made SSR Faster, but the react-bun-ssr Gap Remains
description: A short update on the April 2026 rerun showing Bun 1.3.12 improving both react-bun-ssr and Next.js while the Bun-native SSR gap remains large.
section: Blog
author: gaudiauj
publishedAt: 2026-04-15
tags: bun,benchmark,performance,nextjs,ssr,react,nodejs,rbssr
---

I reran the `react-bun-ssr` benchmark with the newer Bun release because the runtime moved enough that the old numbers deserved a fresh pass.

The canonical benchmark page is still here: [react-bun-ssr benchmarks](/benchmarks). The full methodology article is still here: [A Small, Honest react-bun-ssr vs Next.js Benchmark on Bun and Node](/blog/a-small-honest-rbssr-vs-nextjs-benchmark).

This post is only the update note: Bun `1.3.12` made the benchmark faster, Next.js on Bun improved, and `react-bun-ssr` still kept a large lead in the two measured SSR scenarios.

## What changed in this rerun

The benchmark still uses the same narrow shape:

- one docs-like markdown content route
- one local-data SSR route
- production mode only
- 4 clean builds per app
- 200 warm-up requests per route
- 5 measured `autocannon` runs per route
- concurrency `100`
- duration `30s`
- Apple M1 Pro

The version matrix changed:

| Runtime or package | Version |
| --- | --- |
| `react-bun-ssr` | `0.4.0` |
| Bun | `1.3.12` |
| Next.js 15 | `15.5.14` |
| `@next/mdx` 15 | `15.5.14` |
| Next.js 16 | `16.2.1` |
| `@next/mdx` 16 | `16.2.1` |
| Node 22 | `v22.18.0` |
| Node 24 | `v24.14.1` |
| `autocannon` | `8.0.0` |

## The new top-line result

The fastest Next.js baseline in this run is Next.js 16 on Bun.

That is the right baseline to use when comparing against the best number Next.js produced in this matrix.

| Scenario | `react-bun-ssr` | Fastest Next.js baseline | Gap |
| --- | ---: | ---: | ---: |
| Clean build | `0.13s` | `2.12s` | `16.3x` faster |
| `/content` req/s | `4939.52` | `587.95` | `8.4x` higher |
| `/data` req/s | `874.11` | `236.25` | `3.7x` higher |

That is the useful headline.

Bun improved the benchmark, but the Bun-native framework still has a large advantage in the routes it is currently designed around.

## Next.js on Bun improved too

The most important change from the earlier run is that Bun looks better for Next.js 16 now.

In the March 30 run, Next.js 16 on Bun was mixed. It was slower than Node 24 on the markdown route, slightly faster on the data route, and basically tied on build time.

In this April 15 run, Next.js 16 on Bun is the fastest Next.js entry across all three headline measurements:

| App | Build | `/content` req/s | `/data` req/s |
| --- | ---: | ---: | ---: |
| Next.js 16 on Node 22 | `3.20s` | `362.02` | `137.33` |
| Next.js 16 on Node 24 | `3.13s` | `517.27` | `170.23` |
| Next.js 16 on Bun | `2.12s` | `587.95` | `236.25` |

That makes the comparison stronger, not weaker.

The latest run is no longer "rbssr beats Next.js on Node." It is "rbssr beats the fastest Next.js baseline in this local matrix."

## The rbssr result also improved

`react-bun-ssr` also moved up on Bun `1.3.12`.

Compared with the March 30 run:

| Scenario | March 30 | April 15 | Change |
| --- | ---: | ---: | ---: |
| Clean build | `0.16s` | `0.13s` | faster |
| `/content` req/s | `3686.68` | `4939.52` | `1.34x` higher |
| `/data` req/s | `640.91` | `874.11` | `1.36x` higher |

I would not over-interpret one local rerun as a precise runtime attribution. But the direction is clear enough to justify updating the public benchmark.

## What this does not prove

This still does not prove that `react-bun-ssr` is faster than Next.js for every app.

The benchmark does not cover remote data, databases, CDN behavior, edge deployment, React Server Components in large app trees, or dev server ergonomics.

The result is narrower and more useful than that:

For markdown-heavy and local-data SSR pages, on this Apple M1 Pro, in production mode, Bun `1.3.12` makes the whole benchmark faster while `react-bun-ssr` keeps a large lead over the fastest Next.js baseline in the matrix.

That is the claim I am comfortable making.

## Where to go next

Use the update as a pointer, not as the canonical source.

The maintained summary is the [benchmarks page](/benchmarks). The full methodology and current tables live in [the full benchmark article](/blog/a-small-honest-rbssr-vs-nextjs-benchmark). The executable benchmark suite is in the [react-bun-ssr-benchmark repository](https://github.com/react-formation/react-bun-ssr-benchmark).
