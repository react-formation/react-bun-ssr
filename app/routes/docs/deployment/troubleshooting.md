---
title: Troubleshooting
navTitle: Troubleshooting
description: Debug hydration mismatches, stale generated artifacts, deployment failures, and Bun-version-specific runtime issues.
section: Deployment
order: 3
kind: reference
tags: troubleshooting,hydration,deploy,ci
---

# Troubleshooting

Most production issues in `react-bun-ssr` fall into one of four buckets.

## 1. Hydration mismatch

Check for:

- server/client render branches
- unstable IDs or dates in render output
- mismatched generated CSS module class names across rebuilds
- browser-only globals referenced during SSR

## 2. Stale generated artifacts

Run:

```bash
bun run docs:check
bun run docs:build
```

## 3. Deployment image drift

If production differs from local:

- verify the Bun version in your image
- confirm the build happened before `start`
- confirm copied public assets exist in `dist/client`

## 4. Bytecode-specific issues

If a deployment behaves differently with bytecode enabled, set:

```ts
export default defineConfig({
  serverBytecode: false,
});
```

## Related APIs

- [`FrameworkConfig`](/docs/api/react-bun-ssr)
- [`RouteErrorResponse`](/docs/api/react-bun-ssr-route)

## Next step

Finish with the [API Overview](/docs/api/overview) to move between guides and generated reference quickly.
