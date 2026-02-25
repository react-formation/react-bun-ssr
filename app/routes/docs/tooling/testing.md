---
title: Testing strategy
description: Unit, integration, and e2e expectations for framework and docs surfaces.
section: Tooling
order: 3
tags: testing,ci
---

# Testing strategy

- Unit tests cover routing, middleware order, helpers, serialization.
- Integration tests verify request lifecycle and boundaries.
- E2E tests verify SSR output, hydration, dynamic routes, and docs UX.

CI should execute tests plus docs checks/build generation.
