---
title: Why Next.js 16 and Node 24 Are Faster, and Where Bun Fits
description: A benchmark-driven look at what changed between Next 15 and Next 16, why Node 24 beats Node 22 for this SSR workload, and where Bun helps or does not.
section: Blog
author: gaudiauj
publishedAt: 2026-03-30
tags: nextjs,nodejs,bun,performance,benchmark,ssr
---

These numbers come from a broader benchmark I originally ran while working on `react-bun-ssr`, but this article is only about what changed on the Next.js side. If you want the broader benchmark context, the full comparison is here: [the full benchmark article](/blog/a-small-honest-rbssr-vs-nextjs-benchmark), and the executable benchmark project is here: [react-bun-ssr-benchmark](https://github.com/react-formation/react-bun-ssr-benchmark).

**Update, April 15, 2026:** a newer rerun with Bun `1.3.12` changed the Bun part of the story. Next.js 16 on Bun improved enough to become the fastest Next.js baseline in that rerun, while `react-bun-ssr` still kept a large lead in the same two SSR scenarios. I wrote the update here: [Bun 1.3.12 Made SSR Faster, but the react-bun-ssr Gap Remains](/blog/bun-1-3-12-made-the-benchmark-faster-but-the-rbssr-gap-remains).

The setup behind this post is narrow on purpose: one markdown-heavy content route, one local-data SSR route, production mode only, 4 clean builds, 200 warm-up requests, and 5 measured `autocannon` runs at concurrency `100` for `30s` on an Apple M1 Pro. That does not tell us everything about full-stack React performance, but it is enough to say something useful about three controlled comparisons:

- `Next 15 + Node 24` vs `Next 16 + Node 24`
- `Next 16 + Node 22` vs `Next 16 + Node 24`
- `Next 16 + Node 24` vs `Next 16 + Bun`

## What the benchmark actually shows

These are the medians from that run:

| Stack | Build | `/content` req/s | `/data` req/s |
| --- | ---: | ---: | ---: |
| `Next 15 + Node 24` | `9.23s` | `349.87` | `104.29` |
| `Next 16 + Node 24` | `3.13s` | `517.27` | `170.23` |
| `Next 16 + Node 22` | `3.20s` | `362.02` | `137.33` |
| `Next 16 + Bun` | `3.16s` | `434.41` | `179.34` |

That already tells most of the story.

The biggest jump in this dataset is the framework jump from `Next 15` to `Next 16` while holding the runtime constant at `Node 24`. The second biggest change is the runtime jump from `Node 22` to `Node 24` while holding the framework constant at `Next 16`. Bun is interesting, but it is not the main explanation for the largest gains here.

## Why Next.js 16 is faster

The cleanest framework comparison is `Next 15 + Node 24` against `Next 16 + Node 24`.

With the runtime held constant, the medians moved from:

- build `9.23s -> 3.13s`
- `/content` `349.87 -> 517.27 req/s`
- `/data` `104.29 -> 170.23 req/s`

That is a very large shift, especially for clean build time.

I do not think this benchmark proves which single internal change caused each part of that improvement. But the direction is very consistent with the official [Next.js 15 release](https://nextjs.org/blog/next-15) and [Next.js 16 release](https://nextjs.org/blog/next-16).

`Next 15` already started changing the model. Its release framed the new async request APIs as an "incremental step towards a simplified rendering and caching model", and it changed caching semantics so `fetch`, `GET` route handlers, and client navigations were no longer cached by default. That matters because it suggests the team was already restructuring how work gets scheduled and cached in App Router apps.

`Next 16` is where that direction looks much more mature. The official release post describes the release as the latest set of improvements to Turbopack, caching, and the Next.js architecture. It also says Turbopack is now stable for both development and production builds, is the default bundler for new projects, and can deliver `2-5x` faster production builds. On top of that, `Next 16` introduces Cache Components and refined caching APIs, which point toward more explicit cache boundaries and less accidental work.

That combination lines up well with what the benchmark shows:

- the build result improved the most, which matches Turbopack becoming stable for production work instead of feeling like an optional side path
- the request-time results improved too, which fits the broader architecture and caching changes in the release notes

So my read is not "one feature made Next.js fast". It is that `Next 16` looks like the point where several ongoing changes became coherent enough to show up as a large real-world improvement in a simple SSR benchmark.

## Why Node 24 is faster than Node 22

The runtime comparison is `Next 16 + Node 22` against `Next 16 + Node 24`.

With the framework held constant, the medians moved from:

- build `3.20s -> 3.13s`
- `/content` `362.02 -> 517.27 req/s`
- `/data` `137.33 -> 170.23 req/s`

The build improvement is small. The warm-serve improvement is not. That tells me the Node version change mattered much more for runtime behavior than for clean production build time in this setup.

Again, the benchmark shows the effect, not the exact attribution. But the official [Node.js 24.0.0 release](https://nodejs.org/en/blog/release/v24.0.0) gives three very plausible contributors.

First, Node 24 upgrades to `V8 13.6`. When you are measuring server-rendered React under steady load, better engine behavior can show up directly in rendering hot paths, serialization, and the small utility work around each request.

Second, Node 24 makes `AsyncLocalStorage` use `AsyncContextFrame` by default and explicitly describes that as a more efficient implementation of asynchronous context tracking. That is especially relevant for SSR frameworks, because they tend to carry request-scoped state through a lot of asynchronous boundaries.

Third, Node 24 includes `Undici 7`. I would treat that as broader runtime context rather than the main explanation for this exact benchmark, because this test does not make remote HTTP requests. But it still matters for the general quality of the platform and for other SSR workloads that do depend on `fetch`.

So the most defensible summary is this: the benchmark isolates a real runtime improvement, and the Node 24 release notes describe several platform changes that are very consistent with the shape of that gain, especially the jump in warm SSR throughput.

## Where Bun fits

Bun is the most nuanced part of this dataset.

If you compare `Next 16 + Node 24` against `Next 16 + Bun`, the medians are:

- build `3.13s` vs `3.16s`
- `/content` `517.27` vs `434.41 req/s`
- `/data` `170.23` vs `179.34 req/s`

So Bun is not the main story here.

The biggest step-change is `Next 16`. The second biggest is `Node 24`. Bun is mixed for Next.js in this particular benchmark:

- worse on the markdown-heavy `/content` route
- slightly better on the heavier `/data` route
- basically tied on clean build

That is why I would avoid a simple "Bun makes Next.js faster" conclusion from this run. Sometimes it does. Sometimes it does not. In this dataset, it depends on which route shape you care about.

Still, Bun remains interesting as a runtime and platform. The official [Bun homepage](https://bun.sh/) positions it as an all-in-one toolkit with a runtime, bundler, package manager, and test runner in one stack. Even when the benchmark result is mixed for a specific framework, that broader platform shape can still be attractive for teams thinking about deployment simplicity, tooling surface area, or runtime ergonomics.

## What not to overclaim

This benchmark is not proof that one stack is universally superior.

It is better read as a benchmark-guided explanation of likely contributors:

- `Next 16` appears to be the biggest reason Next.js got faster here
- `Node 24` appears to be the second biggest reason
- Bun is interesting, but mixed, for this exact Next.js workload

It is also important to keep the scope small. These results come from two specific SSR page shapes under one benchmark setup on **March 30, 2026**:

- a markdown-heavy content page
- a local-data SSR page

That is enough to say something meaningful about the direction of the improvements. It is not enough to settle every framework or runtime debate.

## Conclusion

One part of this benchmark feels especially healthy for the ecosystem: the `Next.js` and `Node.js` teams are not just shipping new features, DX polish, and security work. They are still making meaningful performance progress too.

That matters because it is easy to treat framework and runtime upgrades as mostly a compatibility chore. Results like these are a good reminder that staying current can pay back in very practical ways:

- faster builds
- better SSR throughput
- lower latency under load
- a stronger security and platform baseline at the same time

So even if a team is not changing its app architecture, updating to newer major versions can still be one of the simplest ways to get a better system. Sometimes the future version is not just newer. It is materially faster.
