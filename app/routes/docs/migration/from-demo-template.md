---
title: From Demo Template
navTitle: From Demo Template
description: Move from an older demo-style setup to the docs-first, Bun-native framework structure used by the current project.
section: Migration
order: 1
kind: migration
tags: migration,template,upgrade
---

# From Demo Template

Older versions of this project mixed framework experiments, demo app code, and docs concerns together. The current direction is stricter.

## Migration goals

- keep the docs site as the primary product surface
- move authored docs into `app/routes/docs/**/*.md`
- keep generated assets under `.rbssr/` and `dist/`
- use Bun-first runtime helpers consistently

## Typical migration steps

1. Move ad-hoc pages into `app/routes`.
2. Replace generic anchors with `Link` for internal navigation.
3. Move route-specific styling into CSS Modules.
4. Replace custom markdown plumbing with first-class `.md` routes.
5. Regenerate API docs and search artifacts.

## Validation checklist

```bash
bun run test
bun run docs:check
bun run docs:build
```

## Related guides

- [Project Structure](/docs/start/project-structure)
- [File-Based Routing](/docs/routing/file-based-routing)
- [CSS Modules](/docs/styling/css-modules)

## Next step

Return to [Overview](/docs/start/overview) if you want to follow the new documentation flow from the beginning.
