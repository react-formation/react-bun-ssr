# Reference

## Documentation source of truth

- Public docs index: https://react-bun-ssr.dev/docs

In this repository, the public docs are authored from matching local route docs:

- `app/routes/docs/start/project-structure.md`
- `app/routes/docs/routing/file-based-routing.md`
- `app/routes/docs/routing/layouts-and-groups.md`
- `app/routes/docs/routing/middleware.md`
- `app/routes/docs/routing/navigation.md`
- `app/routes/docs/data/loaders.md`
- `app/routes/docs/data/actions.md`
- `app/routes/docs/data/error-handling.md`
- `app/routes/docs/rendering/ssr-hydration.md`
- `app/routes/docs/rendering/streaming-deferred.md`
- `app/routes/docs/rendering/head-meta.md`
- `app/routes/docs/styling/css-modules.md`
- `app/routes/docs/styling/global-css.md`
- `app/routes/docs/styling/public-assets.md`
- `app/routes/docs/deployment/configuration.md`
- `framework/runtime/index.ts`
- `framework/runtime/route-api.ts`
- `framework/runtime/types.ts`

## Imports

- Use `react-bun-ssr` for server startup, config helpers, response helpers, and deployment-facing types.
- Use `react-bun-ssr/route` for route authoring APIs such as `Link`, `Outlet`, `useLoaderData`, `useParams`, `useRequestUrl`, `useRouteError`, `useRouter`, `createRouteAction`, `defer`, `Loader`, `Action`, and `Middleware`.
- Prefer type imports for `Loader`, `Action`, `Middleware`, contexts, and route module types.

## File routing

- `app/routes/index.tsx` maps to `/`.
- `app/routes/tasks/index.tsx` maps to `/tasks`.
- `app/routes/tasks/[id].tsx` maps to `/tasks/:id`.
- `app/routes/tasks/[...filters].tsx` maps to `/tasks/*filters`.
- `app/routes/api/tasks.server.ts` maps to `/api/tasks`.
- `.md` files under `app/routes` are page routes; `.mdx` routes are rejected.
- `_layout` and `_middleware` participate in routing but do not become public URLs.
- Other files whose basename starts with `_` are private colocated files.
- Folders starting with `_` still become URL segments; use `(group)` route groups when the folder should not affect the URL.
- `.server` suffixes are stripped from route IDs and URL paths.

## Server/client boundary

- Keep base page and layout modules client-safe because they can enter the browser bundle.
- Use server companions for Bun-only imports: `app/root.server.tsx`, `app/routes/login.server.tsx`, `app/routes/**/_layout.server.tsx`, and `app/routes/**/_middleware.server.ts`.
- Server companions may export only lifecycle symbols: `loader`, `action`, `middleware`, `head`, `meta`, `onError`, and `onCatch`.
- API routes should be server-only files such as `app/routes/api/search.server.ts` when they need server APIs.
- If both a base module and its companion export the same server lifecycle symbol, the framework should fail startup/build; avoid creating that state.
- Loader-time dynamic imports are a fallback only when a companion split is not practical.

## Loaders

- A loader runs for `GET` and `HEAD` and prepares data for SSR, hydration, and client transitions.
- Loader returns can be serializable data, `Response`, `redirect()`, `defer(...)`, `routeError(...)`, or `notFound(...)`.
- Use `defer()` when slow top-level keys can stream later behind `Suspense` and React `use()`.
- Keep deferred keys top-level and ensure resolved values are serializable.
- Do not put mutation semantics in loaders.
- Read loader data with `useLoaderData<T>()` in the route component.

## Actions

- Use actions for non-GET writes.
- Preferred page mutation shape:

```tsx
// app/routes/tasks/new.tsx
import { useActionState } from "react";
import { createRouteAction } from "react-bun-ssr/route";

type ActionData = { error?: string };
export const action = createRouteAction<ActionData>();

export default function NewTaskPage() {
  const [state, formAction, pending] = useActionState(action, {});
  return <form action={formAction}>{/* fields */}</form>;
}
```

```tsx
// app/routes/tasks/new.server.tsx
import { redirect } from "react-bun-ssr";
import type { Action } from "react-bun-ssr/route";

export const action: Action = async (ctx) => {
  const title = String(ctx.formData?.get("title") ?? "").trim();
  if (!title) return { error: "Title is required" };
  return redirect("/tasks");
};
```

- Prefer `<form action={formAction}>` over `<form method="post">` for page mutations.
- Return plain validation data to stay on the same page.
- Return `redirect()` after successful mutations that should land elsewhere.
- Use `assertSameOriginAction(ctx)` and `sanitizeRedirectTarget(...)` for security-sensitive actions.
- Stage headers and cookies through `ctx.response`.

## Middleware

- Middleware runs before loaders, actions, page rendering, and API handlers.
- Execution order is global middleware, matched ancestor `_middleware` files from top to bottom, matched page `middleware`, then route lifecycle/render work.
- Middleware must return a real `Response` or `await next()`.
- Call `next()` at most once.
- Use `Response.redirect(...)` in middleware, not the framework `redirect()` helper.
- Write request-scoped state to `ctx.locals` for loaders/actions/API handlers.
- API routes use file middleware, not an API module-level `middleware` export.
- Type `ctx.locals` by augmenting `AppRouteLocals` from `react-bun-ssr`.

## Navigation and rendering

- Use `Link` for internal navigation and prefetching.
- Plain `<a>` causes full browser navigation by design.
- `useRouter().refresh()` is a hard reload.
- Server render and client render must be deterministic.
- Avoid `Math.random()`, `Date.now()`, window/document branches, and request-only values during render unless isolated to server lifecycle code or guarded without changing markup.
- `head()` and `meta()` should be deterministic across SSR and hydration.
- `<title>` must resolve to a single string child.
- Use route-specific titles for client transition announcements and SEO.

## Errors and 404s

- Use `routeError(status, data)` for expected caught request-domain errors.
- Use `notFound(data)` when a dynamic route matched but the resource is missing.
- Use `NotFound` exports for unmatched URLs or scoped 404 UI.
- Use `CatchBoundary` for caught route errors.
- Use `ErrorComponent` or legacy `ErrorBoundary` for uncaught exceptions.
- `onCatch` and `onError` observe failures without taking over rendering.

## Styling and assets

- Put route and component styles next to the owner as CSS Modules.
- Keep global CSS for tokens, resets, base typography, and true app-wide primitives.
- Scope `:global(...)` CSS Module bridges under a local class.
- Put public static assets in `app/public` and reference them by root-relative URL.
- Override production static cache defaults through `headers` in `rbssr.config.ts` when needed.

## Config and generated files

- Author config in `rbssr.config.ts` using `defineConfig`.
- Keep repo-root workflows such as `bun install`, `bun run docs:dev`, and `bun run test` unchanged unless explicitly asked.
- Treat `.rbssr/` and `dist/` as generated/disposable output.
- Do not manually edit generated files unless repairing generator output format:
  - `app/routes/docs/api/*.md`
  - `app/routes/docs/search-index.json`
- If exports or docs content change, regenerate generated docs/search artifacts.
- After adding new files under `framework/**`, run `bun install` to refresh Bun's self-package snapshot.

## Validation

- Default validation order for broad code changes:

```bash
bun test
bun run docs:check
bun run docs:build
```

- For docs-only content changes, run at least:

```bash
bun run scripts/build-search-index.ts
bun run scripts/check-docs.ts
```

- Use `bun run typecheck` when type-level public API or route type behavior changed.
