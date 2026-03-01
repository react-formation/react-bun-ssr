---
title: Public Assets
navTitle: Public Assets
description: Serve images, fonts, icons, and other static files from app/public with predictable URLs and production cache headers.
section: Styling
order: 3
kind: reference
tags: assets,static,cache-control
---

# Public Assets

Files in `app/public` are copied into the client output and served as static assets.

## Example

```text
app/public/
  favicon.svg
  images/task-board.png
  fonts/mono.woff2
```

Reference them by root-relative URL:

```tsx
<img src="/images/task-board.png" alt="Task board" />
```

## Production cache behavior

The framework now applies static cache defaults in production:

- hashed JS/CSS bundles: `public, max-age=31536000, immutable`
- other static files: `public, max-age=3600`

You can override those defaults with `headers` rules in `rbssr.config.ts`.

## Related APIs

- [`FrameworkConfig`](/docs/api/react-bun-ssr)
- [`ResponseHeaderRule`](/docs/api/react-bun-ssr)

## Next step

Continue with [Dev Server](/docs/tooling/dev-server) to see how static and generated assets differ in development.
