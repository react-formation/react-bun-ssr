---
title: A Small, Honest react-bun-ssr vs Next.js Benchmark on Bun and Node
description: A narrow production benchmark comparing react-bun-ssr on Bun with Next.js 16.2.1 on Node 24 across a markdown content page and a local-data SSR page.
section: Blog
author: gaudiauj
publishedAt: 2026-03-30
tags: benchmark,bun,nodejs,ssr,react,nextjs,performance,markdown
---

I wanted a first benchmark for react-bun-ssr that says something real without pretending to say everything.

`react-bun-ssr` is a Bun-native SSR React framework with file-based routing, loaders, actions, streaming, soft navigation, and first-class markdown routes. I chose to build it on Bun because I wanted the framework to start from Bun's runtime, server model, bundler, file APIs, and markdown support instead of treating Bun as a compatibility target. If you want the longer background on that decision, I wrote about it here: [Why I Built a Bun-Native SSR Framework](https://react-bun-ssr.dev/blog/why-i-built-a-bun-native-ssr-framework).

So this is intentionally narrow. It is not a universal "framework X is faster than framework Y" post. It is one production-mode comparison against a single modern Next.js baseline, `Next 16.2.1` on `Node 24.14.1`, in two scenarios that match the current shape of `react-bun-ssr` especially well:

- a docs-like markdown content page
- an SSR page that reads a local JSON file and renders a non-trivial HTML list

That is the whole scope.

## Why these two scenarios

The markdown route is the clearest current strength of `react-bun-ssr`.

The framework already treats `.md` files as first-class routes, and the docs site in this repository uses that model directly. If I want to measure a real differentiator instead of inventing a synthetic micro-benchmark, that is the obvious place to start.

The local-data SSR page is the secondary scenario because it exercises a different path:

- read a file at request time
- run server-side rendering
- produce a fairly large HTML response

That gives a second datapoint without collapsing the whole benchmark into a raw JSON endpoint test.

I explicitly did not make a plain JSON API benchmark the headline result. `react-bun-ssr`'s `json()` helper is intentionally thin, so a JSON-only comparison would say more about runtime and serialization details than about the framework itself.

## What I measured

### `/content`

Both measured app/runtime combinations render the same authored markdown fixture:

- 2,382 words
- frontmatter
- 13 rendered `h2`/`h3` headings
- 6 fenced code blocks

For `react-bun-ssr`, this is a first-class `.md` route.

For Next.js, this is an App Router page importing the shared content through the official `@next/mdx` setup.

### `/data`

Both measured app/runtime combinations read the same local `data-benchmark.json` file on every request and render the same 100-item catalog grid on the server.

That is still a small benchmark app, but it is not a one-line hello-world route. It forces both apps to do file I/O plus HTML rendering work on each request.

## Exact setup and fairness rules

These numbers were generated on **March 30, 2026** on the same local machine:

- Apple M1 Pro
- `react-bun-ssr` `0.4.0` built and served with Bun `1.3.10`
- Next.js `16.2.1` built and served with Node `v24.14.1`
- `@next/mdx` `16.2.1`
- `autocannon` `8.0.0`

Benchmark rules:

- production mode only
- 4 clean builds per app
- 200 warm-up requests per route
- 5 measured runs per route
- `autocannon` with concurrency `100` and duration `30s`
- one app running at a time on `localhost`
- no CDN, no compression tuning, no database, no remote fetches, no dev mode

I ran wider Next.js version/runtime matrices separately, but for this article I want the simplest current baseline: `Next 16 + Node 24`.

## Results

Build values below are medians from the four clean builds. Warm-serve values are medians from the five measured runs.

### Clean build

| App | Median clean build |
| --- | ---: |
| `react-bun-ssr` | `0.16s` |
| Next 16 + Node 24 | `3.13s` |

### Warm serve

#### `/content`

| App | req/s | avg latency | p95 latency |
| --- | ---: | ---: | ---: |
| `react-bun-ssr` | `3686.68` | `26.61ms` | `50ms` |
| Next 16 + Node 24 | `517.27` | `192.20ms` | `231ms` |

#### `/data`

| App | req/s | avg latency | p95 latency |
| --- | ---: | ---: | ---: |
| `react-bun-ssr` | `640.91` | `155.06ms` | `230ms` |
| Next 16 + Node 24 | `170.23` | `580.81ms` | `626ms` |

## Interpretation

For these two scenarios, `react-bun-ssr` is substantially faster than this current Next.js baseline on my machine.

The markdown route is the strongest signal, which is not surprising. That benchmark lines up directly with a current design advantage of the framework: first-class markdown routes in a Bun-native pipeline.

Even with a much stronger Next.js baseline than the earlier `Next 15` runs, the gap is still large. `react-bun-ssr` builds about `19x` faster here (`0.16s` vs `3.13s`), serves `/content` about `7x` faster (`3686.68` vs `517.27 req/s`), and serves `/data` about `3.8x` faster (`640.91` vs `170.23 req/s`).

The `/data` route is still closer than `/content`, and that also makes sense. Once both apps are doing more server rendering work over a 100-item page, the benchmark shifts from "who handles content routing and content rendering better" toward "who moves through general SSR work faster."

That is why I like this particular comparison. It is simple, current, and reasonably fair: a modern Next.js release on a modern Node release, against the current `react-bun-ssr`, on the same machine, with the same content and the same local-data route shape.

## What this benchmark does not claim

This benchmark does not prove that `react-bun-ssr` is faster than Next.js for every application or every runtime setup.

It does not cover:

- remote data fetching
- database-backed loaders
- caching layers
- edge deployment
- CDN behavior
- React Server Components tradeoffs in larger app shapes
- developer experience
- dev server performance
- JSON API-only workloads

It is best read as:

`react-bun-ssr` is already very competitive, and in the content-heavy SSR scenarios it is currently built around, it can be extremely fast.

That is a useful claim. It is also a much smaller claim than "this framework beats Next.js everywhere."

## Reproducing it

The executable benchmark suite now lives in a separate repository so it can stay isolated from the main `react-bun-ssr` codebase.

The public benchmark repository is here: [react-bun-ssr-benchmark](https://github.com/react-formation/react-bun-ssr-benchmark).

In that standalone benchmark project, the runner command is:

```bash
bun run bench:run
```

It writes the raw JSON report plus a Markdown-ready summary to that benchmark project's `results/` directory.

That keeps this docs repository focused on the framework and the article itself, while the benchmark project can evolve independently and be rerun against published package versions.
