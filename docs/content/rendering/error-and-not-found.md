---
title: Error boundaries and not-found
description: Boundary resolution order and default fallback behavior.
section: Rendering
order: 2
tags: errors,not-found
---

# Error boundaries and not-found

Errors from loader/action/render are resolved to nearest `ErrorBoundary`.

Not-found requests resolve to nearest `NotFound` export, else framework fallback 404 HTML.

In production, unhandled errors are sanitized before response.
