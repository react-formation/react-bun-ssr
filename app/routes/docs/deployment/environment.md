---
title: Environment configuration
description: Runtime host, port, and mode configuration options.
section: Deployment
order: 2
tags: env,config
---

# Environment configuration

Set host/port in `rbssr.config.ts`.

```ts
import { defineConfig } from "react-bun-ssr";

export default defineConfig({
  host: "0.0.0.0",
  port: 3000,
  mode: "production",
});
```

## Response headers config

You can configure response headers with path-based rules.

```ts
import { defineConfig } from "react-bun-ssr";

export default defineConfig({
  headers: [
    {
      source: "/api/**",
      headers: {
        "x-frame-options": "DENY",
      },
    },
    {
      source: "/client/**",
      headers: {
        "cache-control": "public, max-age=31536000, immutable",
      },
    },
  ],
});
```

Rules are evaluated top-to-bottom, and later matching rules override earlier ones.

## Server bytecode toggle

Server route module bundling uses Bun bytecode by default in production.
You can disable it explicitly:

```ts
import { defineConfig } from "react-bun-ssr";

export default defineConfig({
  serverBytecode: false,
});
```

Defaults:

- `mode: "production"` => `serverBytecode: true`
- `mode: "development"` => `serverBytecode: false`

## Default static cache behavior

In production:

- Hashed JS/CSS chunks under `/client/*` get `cache-control: public, max-age=31536000, immutable`.
- Other static files served by the framework get `cache-control: public, max-age=3600`.

Custom `headers` rules can override these defaults.

## Go deeper with Bun docs

- [Environment variables](https://bun.sh/docs/runtime/env)
- [Bun.serve options](https://bun.sh/docs/api/http)
