---
title: CSS Modules
description: Route-scoped style imports with Bun build output mapping.
section: Styling and Assets
order: 2
tags: css-modules,bundling
---

# CSS Modules

Import CSS Modules directly in route components.

Co-locate styles with the component that uses them:

- `app/root.tsx` -> `app/root.module.css`
- `app/routes/docs/_layout.tsx` -> `app/routes/docs/_layout.module.css`

Example:

```tsx
import styles from "./_layout.module.css";

export default function DocsLayoutRoute() {
  return (
    <main className={styles.main}>
      <aside className={styles.sidebar}>...</aside>
      <article className={styles.content}>...</article>
    </main>
  );
}
```

For framework-emitted markdown classes (for example `.docs-hero`, `.docs-content-body`, `.toc`), style them from a module with a scoped global bridge:

```css
.content :global(.docs-hero) h1 {
  margin: 0.2rem 0 0.55rem;
}
```

During client build, route entry chunks include emitted CSS files and those files are mapped in `dist/manifest.json`.
