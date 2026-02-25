---
title: From demo template
description: Move from demo-centric app routes to docs-first repo layout.
section: Migration
order: 1
tags: migration,docs
---

# From demo template

This repository now treats documentation as the canonical app UI.

## Migration checklist

- Move example pages into markdown snippets under `docs/content`.
- Keep framework implementation in `framework/**` as source of truth.
- Use generated API docs rather than hand-maintained signatures.
- Replace home route with docs redirect.
