---
title: Global CSS
description: Applying global styles from app/public and route head links.
section: Styling and Assets
order: 1
tags: css,global
---

# Global CSS

Global CSS files are typically served from `app/public` and linked in `root.tsx` `head()`.

```tsx
export function head() {
  return <link rel="stylesheet" href="/app.css" />;
}
```
