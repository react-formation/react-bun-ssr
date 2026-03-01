---
title: How I Built react-bun-ssr With AI and Kept the Engineering Bar High
description: How I used AI to build react-bun-ssr faster, the constraints that kept the framework coherent, and the Bun-first architecture choices that made the workflow work.
section: Blog
author: gaudiauj
publishedAt: 2026-03-01
tags: ai,bun,ssr,react,framework,engineering
---

I built `react-bun-ssr` with AI assistance, but the useful part of that sentence is not the AI part. The useful part is how the work was constrained.

AI helped me move faster across implementation, documentation, refactors, and test coverage. It did not remove the need to make architectural decisions, review tradeoffs, or verify that the framework still behaved coherently after each change.

That matters because `react-bun-ssr` is not a toy prompt result. It is a real Bun-native SSR framework with file-based routing, middleware, loaders, actions, streaming, markdown routes, soft navigation, and a docs site built on top of the framework itself.

## Why use AI at all for a framework project?

A framework project is a good candidate for AI-assisted iteration because it has a lot of internal coordination work.

You are not just writing isolated features. You are moving route handling, rendering, client runtime, documentation, tests, generated artifacts, and deployment assumptions at the same time. That creates a lot of repetitive but important work: updating types, keeping docs aligned, adjusting tests after an API change, or applying the same design rule across multiple files.

That is where AI helped the most. Not by inventing the framework, but by shortening the loop from idea to explicit plan to implementation to validation.

The real gain was execution speed on scoped tasks. Once the shape of the work was clear, AI was very effective at carrying changes through the repo faster than I would have done manually.

## The rule that mattered most: AI could execute, but it could not decide

The most important rule was simple: AI could implement, but it could not own product or architecture decisions.

Whenever the task was vague, the output got worse. Vague requests produced vague abstractions, broad rewrites, or code that technically changed files without actually improving the framework. That is exactly what you should expect if the system is missing constraints.

The best results came when the task was decision-complete:

- the scope was explicit
- the file targets were known
- the acceptance criteria were testable
- the edge cases were called out up front
- the public API expectations were already chosen

That pattern showed up repeatedly while building `react-bun-ssr`.

Those decisions were not things I wanted AI making on my behalf. They needed a human point of view about the product.

## The engineering choices that made the workflow actually work

The workflow only worked because I treated process quality as part of the product quality.

Here are the choices that made the AI-assisted development model hold together:

1. **Plan before patch**

Large changes started as detailed plans, not loose requests. The plans included scope, interfaces, constraints, tests, and acceptance criteria. That made the implementation work far more reliable.

2. **Small targeted edits**

Broad rewrites created too much noise and too much risk. Small patches were easier to review, easier to test, and easier to revert mentally if the direction was wrong.

3. **Docs, tests, and runtime moved together**

If behavior changed, the docs changed. If the API changed, the generated artifacts changed. That prevented the framework from drifting out of sync with itself and forced the project to stay honest.

4. **Validation after each meaningful change**

The framework repeatedly went through the same validation cycle:

- `bun test`
- `bun run docs:check`
- `bun run docs:build`
- e2e when routing, rendering, or navigation behavior changed

That discipline caught regressions quickly, especially hydration issues, stale generated artifacts, and routing mismatches.

5. **Use the framework to build its own docs**

Dogfooding turned out to be one of the best decisions in the project. Building the docs site with the framework exposed real problems in SSR, soft navigation, metadata, markdown rendering, responsive behavior, and styling ownership.

6. **Treat generated files and build artifacts as first-class**

The generated API docs, docs manifest, search index, and blog manifest were not side effects to ignore. They were part of the product surface and needed to stay aligned with the code.

## Why Bun made this easier

[Bun](https://bun.sh/) did not just make the framework faster. It made the framework simpler to specify and maintain.

That difference matters. The more layers you have in the stack, the more ambiguity you introduce into the implementation process. A Bun-native approach reduced that sprawl.

Bun gave me a runtime, a bundler, markdown support, file I/O primitives, and server primitives in one system. That made the framework easier to reason about and easier to plan against. It also made AI-assisted implementation more reliable, because the system being described had fewer moving parts and fewer compatibility layers.

That is one of the reasons I kept pushing the codebase toward Bun-first choices, including file I/O, hashing, routing internals, markdown compilation, and server behavior. If you want the direct mapping between the framework and Bun primitives, read [Bun Runtime APIs](/docs/api/bun-runtime-apis).

## What I optimized for in the framework itself

The process matters, but the framework still needed the right product shape.

I optimized for a few principles that I think are visible in the current system:

- Bun-first SSR instead of treating Bun as a secondary target
- [file-based routing](/docs/routing/file-based-routing) with route groups and layouts as core primitives
- [middleware](/docs/routing/middleware) as a first-class request pipeline
- [loaders](/docs/data/loaders) and actions with explicit data flow
- [typed route error handling](/docs/data/error-handling) inspired by TanStack-style ideas, without copying the whole model
- [streaming SSR and deferred data](/docs/rendering/streaming-deferred)
- soft client transitions through `Link` and `useRouter`
- markdown routes as first-class pages
- response header configuration and static caching defaults
- colocated CSS Modules instead of one growing global stylesheet
- docs as a real product surface, not cleanup work after the framework

Those were deliberate choices. I was trying to keep the framework small enough to understand, but complete enough to use seriously.

## Where AI helped the most

AI was strongest when the work was operationally clear.

It helped the most with:

- repository-wide refactors once the plan was locked
- repetitive documentation updates
- keeping tests and generated artifacts aligned with implementation changes
- exploring alternative implementations quickly
- surfacing edge cases once the acceptance criteria were precise

It was much weaker at:

- making product decisions
- preserving visual quality without direction
- deciding whether a new abstraction was actually worth the long-term cost
- recognizing when a clever implementation increased risk instead of reducing complexity

That contrast is important. AI was a force multiplier for execution, not a substitute for judgment.

## What did not work

Some things clearly failed or underperformed during the process.

- vague prompts produced vague code
- broad UI rewrites broke visual parity
- hydration issues appeared when server and client assumptions drifted
- stale dev or build state could hide whether a fix really worked
- letting AI “decide the architecture” was not a viable strategy

Those failures were useful because they made the boundaries clearer. The tighter the task definition became, the better the output became.

## The practical rules I would use again

If I built another framework with AI in the loop, I would keep the same rules:

1. decide the architecture yourself
2. make the task decision-complete before asking for implementation
3. keep changes small enough to verify
4. require tests and docs to move with behavior
5. prefer explicit fallbacks over clever magic
6. use the product to build the product
7. treat AI as leverage, not authority

That is the most transferable part of this project. The framework matters, but the operating model matters too.

## Why this matters if you are evaluating react-bun-ssr

The interesting part is not that AI was involved.

The interesting part is that the framework was built under constraints that pushed it toward coherence. If a framework can survive public iteration, repeated refactors, aggressive documentation work, and constant validation while keeping its routing, rendering, SEO, and tests aligned, that tells you something about the shape of the system.

If you are evaluating `react-bun-ssr`, start with the [Quick Start](/docs/start/quick-start), then look at [file-based routing](/docs/routing/file-based-routing), [streaming and deferred rendering](/docs/rendering/streaming-deferred), and the [Bun deployment guide](/docs/deployment/bun-deployment).

## Closing

AI helped me build `react-bun-ssr` faster, but the framework only got better when the engineering bar stayed high.

If you want to see what that produced, start with the [docs](/docs), read the [Quick Start](/docs/start/quick-start), and inspect the code on [GitHub](https://github.com/react-formation/react-bun-ssr).
