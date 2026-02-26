# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project purpose

`react-bun-ssr` is a Bun-native SSR React framework, and this repo also contains the docs site built with the framework itself.

## High-level map

- `framework/`: framework runtime and build system.
- `bin/rbssr.ts`: CLI entrypoint.
- `app/`: docs web app routes/components/styles.
- `app/routes/docs/**/*.md`: authored markdown docs as first-class routes.
- `app/routes/docs/_sidebar.ts`: canonical docs nav structure.
- `app/routes/docs/api/*.md`: generated API docs.
- `app/routes/docs/search-index.json`: generated search index.
- `scripts/`: docs generation and validation scripts.
- `tests/`: unit/integration tests.
- `e2e/`: Playwright specs.

## Environment assumptions

- Bun `>= 1.3.10`.
- If `bun` is not on PATH in non-interactive shells, use:
  - `export PATH="$HOME/.bun/bin:$PATH"`

## Runtime API policy

- Prefer Bun APIs for file content I/O, hashing, build, and runtime operations.
- Keep `node:path` for path manipulation.
- Keep `node:fs` only for `watch` usage in dev mode.

## Critical rules

1. Do not manually edit generated files unless the task is specifically to repair generation output format.
   - `app/routes/docs/api/*.md`
   - `app/routes/docs/search-index.json`
2. If exports/docs content change, regenerate and commit generated artifacts.
3. Keep docs site as the primary product surface (no demo-first reintroduction).
4. Prefer small, targeted patches over broad rewrites.

## Server/client boundary rules

- Avoid importing Node-only modules in code that can enter browser bundles.
- In route files, do not top-level import server-only helpers if route modules are also used for client hydration.
- For server-only docs loading in routes, use loader-time dynamic imports when needed.

## Known pitfalls

- Dev snapshots: `rbssr dev` serves server modules from `.rbssr/dev/server-snapshots/*`.
  - Files outside `app/` that are imported by server modules must be mirrored in snapshot logic.
- Hydration mismatch can happen if server markup and client markup drift across rebuild versions.
- `<title>` must resolve to a single string child value.

## Recommended workflow for agents

1. Read relevant files with `rg` and `sed` before patching.
2. Make minimal edits.
3. Run validations in this order:

```bash
bun test
bun run docs:check
bun run docs:build
```

4. If only docs content changed, still run at least:

```bash
bun run scripts/build-search-index.ts
bun run scripts/check-docs.ts
```

## Common commands

```bash
bun run docs:dev
bun run docs:check
bun run docs:build
bun run docs:preview
bun run test
bun run typecheck
```

## When changing public API

If changing exports from:

- `framework/runtime/index.ts`
- `framework/runtime/route-api.ts`

You must:

1. Update implementation + types.
2. Regenerate API docs/search index.
3. Ensure docs pages referencing that API remain correct.

## PR checklist for agents

- [ ] Tests pass.
- [ ] Docs checks pass.
- [ ] Build passes.
- [ ] Generated artifacts updated if needed.
- [ ] No server-only code leaked to client runtime.
