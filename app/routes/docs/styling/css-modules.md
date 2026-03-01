---
title: CSS Modules
navTitle: CSS Modules
description: Keep styling close to route and component code, and bridge framework-emitted markdown classes with scoped global selectors.
section: Styling
order: 1
kind: guide
tags: css,modules,styles
---

# CSS Modules

The framework docs app uses CSS Modules as the default styling model because they keep ownership local and hydration-safe.

## Minimal working example

```tsx
import styles from "./tasks.module.css";

export default function TasksPage() {
  return (
    <section className={styles.panel}>
      <h1 className={styles.title}>Task Tracker</h1>
    </section>
  );
}
```

```css
.panel {
  border: 1px solid var(--line);
  border-radius: 20px;
  background: white;
}

.title {
  font-size: 2rem;
}
```

## Bridging framework-emitted markdown classes

Markdown routes emit structural classes like `.docs-hero` and `.docs-content-body`. Style them from a local module with a scoped global bridge:

```css
.content :global(.docs-hero) h1 {
  letter-spacing: -0.03em;
}

.content :global(.docs-content-body) h2 {
  scroll-margin-top: 7rem;
}
```

## Rules

- Put component and route styles next to the component or route.
- Keep global CSS for real global concerns only.
- Scope `:global(...)` bridges under a local class to avoid bleed.

## Related APIs

- [Global CSS](/docs/styling/global-css)
- [Public Assets](/docs/styling/public-assets)

## Next step

Review [Global CSS](/docs/styling/global-css) for the small set of styles that should stay global.
