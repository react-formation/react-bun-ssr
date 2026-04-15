---
title: Global CSS Strategy for Bun React SSR Apps
navTitle: Global CSS
description: Organize global CSS in react-bun-ssr for design tokens, resets, typography primitives, and syntax highlighting while keeping route styles scoped.
section: Styling
order: 2
kind: reference
tags: global-css,tokens,reset
---

# Global CSS

A Bun-native SSR app gets fragile when global CSS becomes the dumping ground for route-specific styles. Keep it small.

## Good global responsibilities

- design tokens in `:root`
- box sizing and element resets
- global body typography
- shared code block and syntax token styles
- app-wide anchor defaults when truly intentional

## What should not stay global

- docs sidebar layout
- route chrome
- page cards and panels
- search modal styling
- markdown-page-specific layout rules unless scoped through a module bridge

## Rules

- Global CSS should be stable across routes.
- If a selector only makes sense for one route tree, move it into a CSS Module.
- Keep syntax highlighting global because highlighted tokens are generated markup, not component-owned classes.

## Related APIs

- [CSS Modules](/docs/styling/css-modules)
- [Public Assets](/docs/styling/public-assets)

## Next step

Learn how the framework serves static files in [Public Assets](/docs/styling/public-assets).
