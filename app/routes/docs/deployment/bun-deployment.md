---
title: Bun Deployment
navTitle: Bun Deployment
description: Ship the production build under Bun with a small deployment surface and no Node adapter layer.
section: Deployment
order: 1
kind: guide
tags: deploy,bun,fly,production
---

# Bun Deployment

Production deployment is straightforward because the framework only targets Bun.

## Minimal flow

```bash
bun install
bun run build
bun run start
```

For Fly.io or similar container-based targets, build the app first and start the production server entry inside Bun.

If you want the Bun-to-framework runtime mapping behind that deployment model, see [Bun Runtime APIs](/docs/api/bun-runtime-apis).

## Recommended checklist

- confirm `dist/manifest.json` exists
- verify your static assets are present in `dist/client`
- keep `Bun.version` aligned between local validation and deployment image
- decide whether `serverBytecode` should be enabled or disabled for your environment

## Related APIs

- [`startHttpServer`](/docs/api/react-bun-ssr)
- [`FrameworkConfig`](/docs/api/react-bun-ssr)

## Next step

Tune runtime behavior in [Configuration](/docs/deployment/configuration).
