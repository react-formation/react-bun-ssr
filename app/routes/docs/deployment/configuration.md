---
title: Deployment Configuration for Bun React SSR Apps
navTitle: Configuration
description: Configure react-bun-ssr deployment settings for headers, ports, public paths, server bytecode behavior, and Bun production runtime defaults.
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
Set a header value to `null` when you want to remove a framework default for a specific path, such as dropping `cache-control` from `/sitemap.xml`.

## Related APIs

- [`defineConfig`](/docs/api/react-bun-ssr)
- [`FrameworkConfig`](/docs/api/react-bun-ssr)
- [`ResponseHeaderRule`](/docs/api/react-bun-ssr)

## Next step

Use [Troubleshooting](/docs/deployment/troubleshooting) when a deploy does not behave like local validation.
