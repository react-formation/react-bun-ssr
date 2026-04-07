---
name: rbssr-correct-usage
description: Enforces correct react-bun-ssr and rbssr usage in apps built with this Bun-native SSR framework, including file routing, server companions, loaders, actions, middleware, rendering, styling, config, and validation. Use when creating or editing app routes, layouts, API handlers, loaders, actions, middleware, head/meta exports, rbssr.config.ts, docs examples, or when the user mentions rbssr, react-bun-ssr, SSR routing, server/client boundaries, or framework conventions.
---

# rbssr Correct Usage

## Quick start

1. Read the nearest relevant docs at `https://react-bun-ssr.dev/docs`; in this repo, use the matching source files under `app/routes/docs/**`.
2. Keep browser-facing route modules client-safe.
3. Put Bun-only lifecycle work in `*.server.ts` or `*.server.tsx` companions.
4. Use `react-bun-ssr` for runtime/config helpers and `react-bun-ssr/route` for route APIs.
5. Validate with the repo's recommended commands before closing.

## Workflow

### 1. Scope the change

- Include route modules, server companions, layouts, middleware, API handlers, config, public assets, and colocated styles affected by the task.
- Check whether a public runtime export changed; if so, update implementation, types, generated API docs, and search index.
- Never manually edit generated docs or search files unless the task is specifically about generation output format.

### 2. Enforce route boundaries

- Page modules own the default React component and must remain browser-safe.
- Server companions export only `loader`, `action`, `middleware`, `head`, `meta`, `onError`, or `onCatch`.
- Use `*.server.ts(x)` for Bun-only imports such as storage, password hashing, and server clients.
- Avoid duplicate lifecycle exports between a base route module and its server companion.

### 3. Use the framework APIs correctly

- Use `loader` for `GET` and `HEAD` data reads.
- Use actions for writes; do not hide mutations inside loaders.
- For page mutations, use React `useActionState` with `createRouteAction()` in the UI route and export the real server `action` from the companion.
- Use `redirect()` only from loaders/actions; middleware should return `Response.redirect(...)` or `next()`.
- Stage headers and cookies through `ctx.response`.

### 4. Validate behavior

- Check SSR/hydration determinism: avoid `Math.random()`, `Date.now()`, and browser-only branches during render.
- Ensure `<title>` resolves to a single string child.
- Use `Link` for internal soft navigation; plain `<a>` intentionally performs full document navigation.
- Keep CSS Modules colocated and reserve global CSS for true global concerns.

## Output rules

- Say which rbssr rules shaped the change.
- Call out any server/client boundary risks.
- Report generated artifacts only when they were intentionally regenerated.
- If validation could not run, state that plainly.

## Advanced features

See [REFERENCE.md](REFERENCE.md).
