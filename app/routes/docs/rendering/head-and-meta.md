---
title: Head and meta
description: Route-level head/meta composition and title handling expectations.
section: Rendering
order: 3
tags: head,meta,title
---

# Head and meta

Routes can export:

- `head(ctx)` for head nodes
- `meta(ctx)` for name/content pairs

Head is collected from root -> layouts -> route.

## Title usage

Prefer a single string child in `<title>` (`{`"Page title"`}`) to avoid React title-array warnings.

## Basic route example

```tsx
import type { HeadContext, MetaContext } from "react-bun-ssr";

export default function PricingPage() {
  return <main><h1>Pricing</h1></main>;
}

export function head(_ctx: HeadContext) {
  return (
    <>
      <title>Pricing | React Bun SSR</title>
      <link rel="canonical" href="https://example.dev/pricing" />
    </>
  );
}

export function meta(_ctx: MetaContext) {
  return {
    description: "Pricing plans for React Bun SSR.",
    "og:title": "Pricing | React Bun SSR",
    "og:type": "website",
  };
}
```

## Layout + leaf route composition

Head values are collected from root -> layout(s) -> page route.

```tsx
// app/routes/docs/_layout.tsx
export function head() {
  return (
    <>
      <title>Docs | React Bun SSR</title>
      <meta charSet="utf-8" />
    </>
  );
}
```

```tsx
// app/routes/docs/getting-started/introduction.tsx
export function head() {
  return <title>Introduction | React Bun SSR Docs</title>;
}

export function meta() {
  return {
    description: "Start here to understand routing, loaders, and rendering.",
  };
}
```

## Dynamic titles from loader data

```tsx
import type { HeadContext } from "react-bun-ssr";

export async function loader({ params }: { params: { slug?: string } }) {
  const article = await getArticleBySlug(params.slug ?? "");
  return { article };
}

export function head(ctx: HeadContext<{ article: { title: string } }>) {
  return <title>{ctx.data.article.title} | Blog</title>;
}
```
