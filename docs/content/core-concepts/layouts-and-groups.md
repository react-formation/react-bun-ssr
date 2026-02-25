---
title: Nested layouts and route groups
description: Compose reusable shells with _layout and organize filesystem with ignored route groups.
section: Core Concepts
order: 2
tags: layout,groups
---

# Nested layouts and route groups

`_layout.tsx` wraps descendants through `<Outlet />` composition.

## Resolution order

Parent layouts wrap child layouts, then leaf route content.

## Route groups

Folders like `(marketing)` are ignored in URL paths while still structuring files.
