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
