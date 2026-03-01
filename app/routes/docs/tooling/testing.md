---
title: Testing
navTitle: Testing
description: Test the framework and your app across unit, integration, and e2e layers without losing SSR or routing coverage.
section: Tooling
order: 3
kind: reference
tags: tests,unit,integration,e2e
---

# Testing

The framework repo itself uses a layered test model, and application code should follow the same pattern.

## Recommended layers

- unit tests for pure utilities and route-model logic
- integration tests for request/response behavior
- e2e tests for navigation, hydration, and document semantics

## Useful commands

```bash
bun run test
bun run test:unit
bun run test:integration
bun run test:e2e
```

## What to cover in a Task Tracker app

- loader serialization and deferred data
- action redirects and validation payloads
- route-error handling and not-found behavior
- soft transitions between shared layouts
- metadata updates across client navigation

## Related APIs

- [`Loader`](/docs/api/react-bun-ssr-route)
- [`Action`](/docs/api/react-bun-ssr-route)
- [`useRouter`](/docs/api/react-bun-ssr-route)

## Next step

Inspect production output in [Build Output](/docs/tooling/build-output).
