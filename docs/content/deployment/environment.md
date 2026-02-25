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
