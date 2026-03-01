---
title: Configuration
navTitle: Configuration
description: Configure headers, ports, public paths, and server bytecode behavior through rbssr.config.ts.
section: Deployment
order: 2
kind: reference
tags: config,headers,bytecode
---

# Configuration

`rbssr.config.ts` is the operational control surface for the framework.

## Example

```ts
import { defineConfig } from "react-bun-ssr";

export default defineConfig({
  port: 3000,
  headers: [
    {
      source: "/api/**",
      headers: {
        "x-frame-options": "DENY",
      },
    },
  ],
  serverBytecode: true,
});
```

## Important settings

- `headers` for path-based response headers
- `serverBytecode` to enable or disable Bun bytecode for server bundles
- `mode`, `port`, and directory overrides

## Cache policy defaults

Production static assets receive cache headers automatically. User header rules override framework defaults.

## Related APIs

- [`defineConfig`](/docs/api/react-bun-ssr)
- [`FrameworkConfig`](/docs/api/react-bun-ssr)
- [`ResponseHeaderRule`](/docs/api/react-bun-ssr)

## Next step

Use [Troubleshooting](/docs/deployment/troubleshooting) when a deploy does not behave like local validation.
