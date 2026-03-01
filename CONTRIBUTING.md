# Contributing to react-bun-ssr

`react-bun-ssr` contains both the framework and the official docs site built with the framework itself. Contributors may touch framework code, docs content, blog content, generators, or tests, but the quality bar stays the same: behavior, docs, tests, and generated artifacts must remain aligned.

## Prerequisites

- Bun `>= 1.3.10`
- macOS/Linux or another Bun-supported environment
- If Bun is not on PATH in non-interactive shells:

```bash
export PATH="$HOME/.bun/bin:$PATH"
```

## Local setup

```bash
git clone git@github.com:react-formation/react-bun-ssr.git
cd react-bun-ssr
bun install
bun run docs:dev
```

This boots the docs site built with the framework itself. The repo-root app is the primary product surface for local development.

## Where to make changes

- Framework runtime, build system, and CLI: `framework/**`, `bin/**`
- Authored docs: `app/routes/docs/**/*.md`
- Blog posts: `app/routes/blog/*.md`
- Docs navigation: `app/routes/docs/_sidebar.ts`
- Generators and checks: `scripts/**`
- Tests: `tests/**`, `e2e/**`

## Contributor workflow

1. Create a branch.
2. Make targeted changes.
3. Regenerate artifacts when the change affects generated output.
4. Run validations.
5. Open a PR with:
   - the problem statement
   - the approach and tradeoffs
   - the testing performed

## Generated files policy

Do not hand-edit generated files unless the task is specifically to fix the generator output format.

Generated artifacts in this repo include:

- `app/routes/docs/api/*.md`
- `app/routes/docs/docs-manifest.json`
- `app/routes/docs/search-index.json`
- `app/routes/blog/blog-manifest.json`

Regenerate them with:

```bash
bun run scripts/generate-api-docs.ts
bun run scripts/build-docs-manifest.ts
bun run scripts/build-search-index.ts
bun run scripts/build-blog-manifest.ts
```

Or run:

```bash
bun run docs:build
```

## Validation requirements

Recommended validation order:

```bash
bun run test
bun run docs:check
bun run docs:build
```

If only docs or blog content changed, still run at least:

```bash
bun run scripts/build-search-index.ts
bun run scripts/check-docs.ts
```

Additional useful checks:

- `bun run typecheck`
- `CI=1 bun run test:e2e` for routing, rendering, and navigation-heavy changes

## CI, deploys, and releases

- Branch pushes and pull requests run the core CI suite:
  - `typecheck`
  - unit tests
  - integration tests
  - docs check
  - docs build
- Pushes to `main` also run e2e and, after success, deploy to the Fly production app.
- Tags like `v0.1.1-rc.0` publish npm prereleases under the `rc` dist-tag.
- Tags like `v0.1.1` publish stable npm releases under `latest`.
- The Git tag is the source of truth for npm versioning.
- The release workflow rewrites `package.json` inside the release job before publishing.
- npm publishing uses trusted publishing via GitHub OIDC and requires the package trusted publisher to be configured on npm.
- Configure the npm trusted publisher with:
  - organization/user: `react-formation`
  - repository: `react-bun-ssr`
  - workflow filename: `release.yml`

## Change-specific guidance

- If public runtime exports change:
  - update implementation and types
  - regenerate API docs and search artifacts
  - confirm docs pages remain accurate
- If docs navigation changes:
  - update `app/routes/docs/_sidebar.ts`
  - regenerate docs manifest and search index
- If blog content changes:
  - regenerate `app/routes/blog/blog-manifest.json`

## Server/client boundary reminder

- Avoid Node-only imports in code that can enter browser bundles.
- In route files, avoid top-level server-only imports if the route module also hydrates on the client.
- Use loader-time dynamic imports when data or helpers must stay server-only.

## Pull request checklist

- [ ] Tests pass
- [ ] Docs checks pass
- [ ] Build passes
- [ ] Generated artifacts updated if needed
- [ ] No server-only code leaked into client runtime
