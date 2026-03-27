# Changelog

All notable changes to `react-bun-ssr` are documented in this file.

## [0.4.0] - 2026-03-27

### Breaking

- Page-route document mutations are no longer supported. Non-`GET/HEAD` requests to page routes now return `405`.
- `useActionData` has been removed from:
  - `react-bun-ssr`
  - `react-bun-ssr/route`
- SSR action payload plumbing via `actionData` was removed. Loader payloads remain `loaderData`-only.

### Added

- First-class server-only route model with `*.server.ts` / `*.server.tsx` support for:
  - `app/root.server.tsx`
  - `app/routes/**/_layout.server.tsx`
  - page route companions (`app/routes/**/page.server.tsx`)
  - global middleware (`app/middleware.server.ts`)
  - nested middleware (`app/routes/**/_middleware.server.ts`)
  - API route files (`app/routes/api/**.server.ts`)
- New `createRouteAction<TState>()` export in `react-bun-ssr/route` for direct React 19 form actions:
  - `useActionState(action, initialState)` where `action = createRouteAction<TState>()`
- Internal action endpoint: `POST /__rbssr/action?to=...` with typed envelopes:
  - `data`
  - `redirect`
  - `catch`
  - `error`
- Typed locals augmentation surface:
  - `AppRouteLocals` (root + route entrypoints)
  - threaded through middleware, loaders, actions, and API handlers
- Response mutation primitives on request context:
  - `ctx.response.headers.set/append/delete`
  - `ctx.response.cookies.get/set/delete`
- Security helpers:
  - `assertSameOriginAction`
  - `sanitizeRedirectTarget`

### Changed

- `useRouteAction` is still supported and now shares the same action transport path as `createRouteAction`.
- Companion merge behavior now allows `action` in both base + companion only when base `action` is a marked client stub (`createRouteAction`).
- Server runtime strips client action stubs from server-executed modules, preventing accidental server execution of client stubs.
- Route scanning/build/dev flows treat `.server` files as server-only and keep them out of client bundling.
- Dev/runtime behavior now consistently reloads for `.server` changes in dev paths.

### Fixed

- Bun-only/server-only imports can now live in server companions without leaking into browser bundles.
- Staged response headers/cookies are committed consistently across plain data, redirects, middleware short-circuits, transition paths, and explicit `Response` returns.
- `ctx.locals` typing now works end-to-end without app-level type-recovery hacks.

### Docs

- Updated framework docs and API docs to the `useActionState + createRouteAction` model.
- Updated README, `app/public/llms.txt`, and `AGENTS.md` with the new action/server-companion guidance.
- Regenerated:
  - API docs (`app/routes/docs/api/*.md`)
  - docs manifest (`app/routes/docs/docs-manifest.json`)
  - search index (`app/routes/docs/search-index.json`)

### Tests

- Added/updated unit + integration coverage for:
  - server-only companions and `.server` route scanning/build behavior
  - action endpoint envelope behavior
  - `createRouteAction` and `useRouteAction` compatibility
  - response mutation commit semantics
  - typed locals usage across middleware/loader/action/API
  - page-route mutation `405` behavior and migration path messaging

### Migration

- For page mutations, move to React 19 actions:
  - UI route file: `export const action = createRouteAction<TState>()`
  - server companion: `export const action: Action = async (ctx) => { ... }`
  - component: `const [state, formAction] = useActionState(action, initialState)`
- Move Bun-only imports into `*.server.ts(x)` files.
- Replace `useActionData` usage with `useActionState` state handling.
- `useRouteAction` can remain temporarily for backward-compatible migrations.

## [0.3.2] - 2026-03-06

### Added

- New streaming doctype wrapper utility (`prependDoctypeStream`) with dedicated coverage for cancel/error/reader-lock behavior.

### Fixed

- `rbssr init` now scaffolds a fully usable starter app shape (`package.json`, `tsconfig`, `.gitignore`, CSS module, favicon) with updated docs and tests.
- Router `onNavigate` listener lifecycle is now stable across render/commit cycles and initial navigation emission.
- Streamed document rendering now handles doctype prepending without reader lock/cancel edge-case regressions.
- Runtime POSIX I/O helpers now await process completion correctly (directory creation/removal reliability improvements).
- Sitemap build tooling now supports injecting a custom git executable for lastmod lookup and improved git-unavailable fallback behavior.
- Managed head reconciliation no longer uses `innerHTML` in node signatures, reducing client transition diff cost and avoiding false mismatches from formatting-only changes in inline `script` and related head nodes.
- Dev app file watching no longer recurses through linked framework copies under `app/node_modules`, avoiding `EMFILE` failures in docs dev/e2e environments.


### Changed

- Package metadata was refreshed for npm discoverability (description/keywords/homepage/license) and aligned to the `0.3.x` line.
- Client route snapshot ordering is now normalized with a shared specificity sorter before hydration payload emission, making the client matcher contract explicit and stable for static-vs-dynamic route precedence.

## [0.3.1] - 2026-03-03

### Fixed

- `rbssr init` now scaffolds a usable starter app out of the box.

### Changed

- Follow-up framework/docs separation cleanup after the `0.3.0` split (`build-tools`, `client-runtime`, tree composition paths, and package smoke metadata checks).

## [0.3.0] - 2026-03-03

### Added

- `onNavigate` callback support in client navigation flow.
- Public config now allows removing default `cache-control` headers via `null` values in response header rules.

### Changed

- Framework/package boundary split was completed (framework artifacts and runtime/package ownership isolated from docs app concerns).
- Head/meta rendering semantics were tightened: deterministic title/meta resolution and deeper deduplication behavior.

### Fixed

- Production build path now consistently forces production `NODE_ENV` semantics.
- Title updates now remain correct across SSR and client transitions.
- Dev client/watch runtime integration was hardened to support analytics script injection lifecycle in dev snapshots.

## [0.2.0] - 2026-03-02

### Added

- New dedicated dev runtime and route table modules (`dev-runtime`, `dev-route-table`) for CLI dev orchestration.
- New client transition core module to isolate transition parsing/guard logic from UI wiring.

### Changed

- Major runtime/CLI optimization and refactor pass across build tools, module loading, route adaptation, matcher behavior, render/server flow, and client runtime internals.
- CLI command/internal entrypoints were reorganized to reduce coupling between command parsing, dev orchestration, and build/start flows.
- Framework test harness coverage expanded substantially (unit/integration/e2e) to lock runtime contracts before `0.3.x` changes.

### Fixed

- Package publishing metadata for trusted npm publishing was corrected.

## [0.1.2] - 2026-03-01

### Changed

- No framework runtime/CLI/API changes in this release.

## [0.1.1] - 2026-03-01

### Added

- First tagged public release line for `0.1.x`.

> Note: there is no separate `v0.1.0` tag in this repository. `0.1.x` history begins at `v0.1.1`.

[Unreleased]: https://github.com/react-formation/react-bun-ssr/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/react-formation/react-bun-ssr/compare/v0.3.2...v0.4.0
[0.3.2]: https://github.com/react-formation/react-bun-ssr/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/react-formation/react-bun-ssr/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/react-formation/react-bun-ssr/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/react-formation/react-bun-ssr/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/react-formation/react-bun-ssr/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/react-formation/react-bun-ssr/releases/tag/v0.1.1
