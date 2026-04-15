# Plan: SEO and Marketing Growth

> Source: Bing Webmaster Tools feedback and grill-me planning session, 2026-04-15.

## Problem

Bing Webmaster Tools reported three high-level issues:

- The site does not have enough inbound links from high quality domains.
- Meta descriptions on many pages are too short.
- Many page titles are too short.

The site already has the core technical SEO plumbing:

- sitemap
- robots.txt
- canonical URLs for docs and blog pages
- Open Graph and Twitter metadata
- blog `Article` JSON-LD
- docs and blog manifests
- generated search index

The main gaps are therefore not basic crawlability. The gaps are:

- search-facing title and description specificity
- durable metadata quality checks
- evergreen linkable assets beyond dated blog posts
- internal linking and conversion paths
- external distribution for high-quality inbound links

## Positioning

Primary 90-day SEO positioning:

> `react-bun-ssr` is the Bun-native React SSR framework.

Primary query cluster:

- Bun-native React SSR framework
- React SSR on Bun
- Bun React framework
- Bun file-based routing
- React streaming SSR framework

Secondary query cluster:

- Next.js alternative for Bun
- React SSR framework comparison
- Bun SSR benchmark
- Bun-native routing and loaders

## Architectural Decisions

Durable decisions that apply across all phases:

- **Docs remain the primary product surface**: marketing additions should reinforce docs, not replace them.
- **Blog remains narrative**: blog posts can explain decisions, benchmarks, and launch notes, but should not be the only canonical target for search intent.
- **Evergreen pages carry link intent**: benchmark, comparison, example, and roadmap pages should be stable URLs that external sites can cite.
- **Manual metadata wins over generated fluff**: use automation to audit title and description quality, but write metadata manually per page.
- **Navigation labels stay concise**: keep `navTitle` short for sidebar UX while making `title` and `description` more search-specific.
- **Avoid fake schema**: add structured data only where the page content honestly supports it.
- **No low-quality backlink tactics**: pursue links from GitHub, npm, Bun/React ecosystem discussions, newsletters, technical articles, and relevant community posts.
- **Framework credibility leads**: product value should appear before personal build journey content.

## Phase 1: SEO Metadata Audit and Cleanup

**Status**: implemented in the current working branch at the time this plan was written.

### Goal

Address Bing's title and meta description warnings with low-risk docs and blog metadata changes.

### What to build

- Add a metadata audit script for docs and blog markdown routes.
- Add a package script for running the audit.
- Rewrite short or generic docs titles and descriptions.
- Keep `navTitle` unchanged so docs navigation remains stable.
- Update generated API docs through `scripts/generate-api-docs.ts`, not by hand-editing generated API markdown.
- Regenerate docs manifest, blog manifest, search index, API docs, and sitemap as needed.

### Metadata rules

- Docs title target: 35-70 characters.
- Docs description target: 120-170 characters.
- Blog title target: 35-70 characters.
- Blog description target: 120-170 characters.
- Titles should include topic plus relevant Bun, React, SSR, route, data, rendering, or deployment context where natural.
- Descriptions should describe the reader outcome, not just the page contents.

### Acceptance criteria

- [ ] `bun run docs:audit-seo` reports no weak title or description lengths.
- [ ] `bun run docs:audit-seo -- --strict` exits successfully.
- [ ] `bun run docs:check` passes.
- [ ] `bun run docs:build` passes.
- [ ] Generated docs artifacts are refreshed from source scripts.
- [ ] Docs sidebar labels remain concise through unchanged `navTitle` values.

## Phase 2: Evergreen Benchmarks Page

**Status**: implemented in the current working branch at the time this plan was updated.

### Goal

Create the first durable, high-linkability page that can attract inbound links and summarize existing benchmark content.

### What to build

Add a `/benchmarks` route that acts as the canonical benchmark landing page.

The page should include:

- a clear benchmark summary
- what was measured
- benchmark environment and constraints
- key results
- honest caveats
- links to the full benchmark blog post
- links to docs pages that explain relevant framework features
- CTA to Quick Start
- CTA to GitHub repository

### Recommended route shape

- `app/routes/benchmarks.tsx`
- `app/routes/benchmarks.module.css` if route-specific styling is needed

### Metadata

Recommended title:

```yaml
title: react-bun-ssr Benchmarks for Bun React SSR
```

Recommended description:

```yaml
description: Review honest react-bun-ssr benchmarks for Bun-native React SSR, including measured scenarios, constraints, caveats, and links to full writeups.
```

### Acceptance criteria

- [ ] `/benchmarks` renders as a first-class public page.
- [ ] The page has route-specific title, description, canonical URL, Open Graph, and Twitter metadata.
- [ ] The page links to the benchmark blog post.
- [ ] The benchmark blog post links back to `/benchmarks`.
- [ ] The docs homepage links to `/benchmarks`.
- [ ] The sitemap includes `/benchmarks`.
- [ ] `bun run docs:check` passes.
- [ ] `bun run docs:build` passes.

## Phase 3: Internal Link and Conversion Cleanup

**Status**: partially implemented in the current working branch through top navigation, footer, docs homepage, blog index, benchmark article, README, and sitemap links.

### Goal

Make SEO visitors move from discovery pages to adoption paths.

### What to build

Standardize internal CTAs across key pages:

- Start with Quick Start
- Read the benchmark
- View the GitHub repository
- Install react-bun-ssr
- Compare with Next.js

Likely pages to update:

- docs homepage
- blog index
- benchmark blog post
- README
- npm package metadata if needed

### Conversion path

Target flow:

```text
Search visitor lands on comparison, benchmark, blog, or docs page
-> understands positioning in 10 seconds
-> sees proof and tradeoffs
-> clicks Quick Start or GitHub
-> runs the install/init command
-> reaches a working app
```

### Acceptance criteria

- [ ] Docs homepage includes a clear benchmark or proof link.
- [ ] Blog index links to evergreen benchmark/comparison pages where relevant.
- [ ] Benchmark article links to `/benchmarks`.
- [ ] README links to docs, blog, benchmarks, and GitHub discovery-relevant pages.
- [ ] CTAs are consistent and not excessive.

## Phase 4: Structured Data Expansion

**Status**: implemented in the current working branch at the time this plan was updated.

### Goal

Improve machine understanding without adding dishonest or unsupported schema.

### What to build

Add structured data where it maps cleanly to existing content:

- `WebSite` with `SearchAction` if public search is stable and useful.
- `SoftwareSourceCode` or `SoftwareApplication` on the primary docs/home surface.
- `BreadcrumbList` for docs pages.
- `BreadcrumbList` for blog pages.
- `TechArticle` or `WebPage` for high-value docs pages, if implementation remains maintainable.

Do not add:

- fake FAQ schema
- review/rating schema
- product schema that implies commercial availability beyond the framework package
- over-broad schema that duplicates every page without useful context

### Acceptance criteria

- [ ] JSON-LD is serialized safely through existing site helpers.
- [ ] Docs and blog pages expose breadcrumbs where page hierarchy is clear.
- [ ] Structured data validates conceptually against page content.
- [ ] `bun run docs:check` passes.
- [ ] `bun run docs:build` passes.

## Phase 5: Next.js Comparison Page

**Status**: implemented in the current working branch at the time this plan was updated.

### Goal

Create a stable page for high-intent comparison searches and external citations.

### What to build

Add:

```text
/comparison/react-bun-ssr-vs-nextjs
```

The page should be practical and honest:

- when `react-bun-ssr` is a good fit
- when Next.js is a better fit
- runtime difference: Bun-native vs Node-oriented ecosystem
- framework scope difference
- routing, loaders, actions, streaming, deployment, and ecosystem tradeoffs
- links to benchmarks and relevant docs

### Acceptance criteria

- [ ] Comparison page avoids shallow marketing claims.
- [ ] Page has clear title, description, canonical, Open Graph, and Twitter metadata.
- [ ] Page links to `/benchmarks`.
- [ ] Page links to Quick Start.
- [ ] Sitemap includes the route.
- [ ] `bun run docs:check` passes.
- [ ] `bun run docs:build` passes.

## Phase 6: Examples Page

### Goal

Give prospective users a fast way to assess real usage without reading every docs page.

### What to build

Add:

```text
/examples
```

Initial examples can be lightweight:

- Task Tracker route tree
- loader and action example
- deferred data example
- API route example
- server companion example
- deployment starter shape

Each example should link to the deeper docs page.

### Acceptance criteria

- [ ] `/examples` gives a compact overview of representative framework use cases.
- [ ] Examples link to source docs or code snippets.
- [ ] Page has search-specific metadata.
- [ ] Page links to Quick Start and GitHub.
- [ ] Sitemap includes the route.
- [ ] `bun run docs:check` passes.
- [ ] `bun run docs:build` passes.

## Phase 7: Roadmap Page

### Goal

Increase framework credibility by making maintenance direction explicit.

### What to build

Add:

```text
/roadmap
```

The page should include:

- what is stable now
- what is intentionally small in scope
- near-term improvements
- known non-goals
- links to GitHub issues or milestones if available

### Acceptance criteria

- [ ] Roadmap is honest and specific.
- [ ] Page avoids overpromising timelines.
- [ ] Page links to GitHub issues or discussions where relevant.
- [ ] Page has search-specific metadata.
- [ ] Sitemap includes the route.
- [ ] `bun run docs:check` passes.
- [ ] `bun run docs:build` passes.

## Phase 8: SEO Audit Enforcement

### Goal

Prevent title and description regressions after the cleanup is accepted.

### What to build

Promote the audit from report-only to CI/docs-check enforcement.

Recommended approach:

- Keep `bun run docs:audit-seo` as a standalone report.
- Add `bun run docs:audit-seo -- --strict` to `docs:check` after thresholds prove useful.
- Keep thresholds pragmatic and easy to tune.

### Acceptance criteria

- [ ] `docs:check` fails when docs or blog metadata falls outside accepted title/description length ranges.
- [ ] Generated API pages are validated through generated output, with source metadata maintained in generator scripts.
- [ ] Error messages identify the exact file, field, length, and expected range.

## Phase 9: External Distribution Checklist

### Goal

Address the inbound-link warning with high-quality, relevant distribution.

### What to do

After `/benchmarks` is live:

- Link `/benchmarks` from the GitHub README.
- Link docs, blog, and benchmark pages from npm metadata where appropriate.
- Add GitHub topics that match real positioning: `bun`, `react`, `ssr`, `framework`, `file-based-routing`.
- Share the benchmark page or launch article in relevant communities once it is polished.
- Reach out to articles or repos already discussing Bun SSR or React SSR where `react-bun-ssr` is relevant.
- Cross-link from personal or organization sites where available.
- Avoid low-quality directories, paid links, or irrelevant backlink swaps.

### Acceptance criteria

- [ ] GitHub README contains stable links to docs, blog, benchmarks, and Quick Start.
- [ ] npm package metadata points to the docs site.
- [ ] The project has relevant GitHub topics.
- [ ] At least one polished evergreen page is shared externally.
- [ ] External outreach links to evergreen pages rather than only dated blog posts.

## Non-Goals

- Do not create a large marketing site before the docs and first evergreen pages are strong.
- Do not mechanically append `| react-bun-ssr` to every title.
- Do not rewrite docs content just to satisfy metadata length.
- Do not add fake FAQ/schema markup.
- Do not pursue low-quality backlinks.
- Do not optimize internal test routes such as `/framework-test/*` for SEO; keep them noindexed or out of public discovery.
- Do not let personal AI-build-story positioning outrank framework credibility on primary landing pages.

## Recommended Commit Sequence

1. `Improve docs SEO metadata`
2. `Add benchmarks landing page`
3. `Improve internal SEO links`
4. `Add structured data for docs and blog`
5. `Add Next.js comparison page`
6. `Add examples landing page`
7. `Document project roadmap`
8. `Enforce SEO metadata audit`
