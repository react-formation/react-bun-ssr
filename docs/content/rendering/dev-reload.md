---
title: Dev reload model
description: How dev rebuild, server snapshots, and SSE reload notifications work.
section: Rendering
order: 4
tags: dev,sse,reload
---

# Dev reload model

Development mode uses server-sent events (`/__rbssr/events`) for reload signals.

## Why snapshots exist

Server modules are loaded from versioned snapshots so request handling and route discovery stay in sync during rebuilds.

## Expected behavior

After content edits, the next request receives latest server snapshot and latest client route asset version.
