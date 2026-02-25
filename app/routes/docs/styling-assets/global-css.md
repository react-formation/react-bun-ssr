---
title: Global CSS
description: Applying global styles from app/public and route head links.
section: Styling and Assets
order: 1
tags: css,global
---

# Global CSS

Keep global CSS minimal and focused on app-wide primitives:

- design tokens (`:root`)
- reset/base element rules (`html`, `body`, `a`, `code`, `pre`)
- syntax-highlight token styles

Component and route layout styles should live in co-located CSS Modules.

Global CSS is served from `app/public` and linked in `root.tsx` `head()`.

```tsx
export function head() {
  return <link rel="stylesheet" href="/app.css" />;
}
```
