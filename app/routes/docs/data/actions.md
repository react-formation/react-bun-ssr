---
title: Form Actions and Mutations in Bun React SSR
navTitle: Actions
description: Process mutating requests in react-bun-ssr with server actions, form validation, redirects, and Task Tracker writes that stay server-owned.
section: Data
order: 2
kind: guide
tags: actions,forms,redirects,mutations
---

# Actions

Actions handle non-GET mutations. In the `Task Tracker`, creating or updating a task belongs here.

## Minimal working example

```tsx
// app/routes/tasks/new.tsx
import { useActionState } from "react";
import { createRouteAction } from "react-bun-ssr/route";

type NewTaskActionData = { error?: string };
export const action = createRouteAction<NewTaskActionData>();

export default function NewTaskPage() {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction}>
      {state.error ? <p role="alert">{state.error}</p> : null}
      <input name="title" placeholder="Ship docs redesign" />
      <input name="assignee" placeholder="Owner" />
      <button type="submit" disabled={pending}>Create task</button>
    </form>
  );
}
```

```tsx
// app/routes/tasks/new.server.tsx
import { redirect } from "react-bun-ssr";
import type { Action } from "react-bun-ssr/route";

type NewTaskActionData = { error?: string };

export const action: Action = async (ctx) => {
  const title = String(ctx.formData?.get("title") ?? "").trim();
  const assignee = String(ctx.formData?.get("assignee") ?? "").trim();

  ctx.response.headers.set("x-action", "new-task");
  if (!title) {
    return { error: "Title is required" } satisfies NewTaskActionData;
  }

  await Promise.resolve({ title, assignee });
  ctx.response.cookies.set("flash", "task-created", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });
  return redirect("/tasks");
};
```

## Same-route validation flow

When an action returns plain data:

- the `useActionState()` tuple state updates with the action payload
- redirects are handled by framework navigation when the server action returns `redirect()`
- caught/uncaught action failures reject the submit promise and bubble to boundaries

Page-route document `POST` requests are no longer the mutation path. Use `<form action={formAction}>` with `useActionState(action, initialState)` and `action = createRouteAction(...)`.

## Small security helpers

Use same-origin checks and safe redirect sanitization directly in actions:

```ts
import { assertSameOriginAction, redirect, sanitizeRedirectTarget } from "react-bun-ssr";
import type { Action } from "react-bun-ssr/route";

export const action: Action = async (ctx) => {
  assertSameOriginAction(ctx);

  const next = sanitizeRedirectTarget(
    String(ctx.formData?.get("next") ?? "/dashboard"),
    "/dashboard",
  );

  return redirect(next);
};
```

`sanitizeRedirectTarget()` allows only safe site-relative paths, including query/hash. Unsafe absolute and protocol-relative inputs fall back.

## Auth-oriented server companion snippet

Keep the page component client-safe and put Bun-only auth logic in `*.server.tsx`:

```tsx
// app/routes/login.server.tsx
import { assertSameOriginAction, redirect, sanitizeRedirectTarget, type Action } from "react-bun-ssr";
import { findUserByEmail, readPasswordHash, saveSession } from "../lib/auth.server";

export const action: Action = async (ctx) => {
  assertSameOriginAction(ctx);

  const email = String(ctx.formData?.get("email") ?? "").trim().toLowerCase();
  const password = String(ctx.formData?.get("password") ?? "");
  const next = sanitizeRedirectTarget(String(ctx.formData?.get("next") ?? "/dashboard"));

  const user = await findUserByEmail(email);
  const hash = user ? await readPasswordHash(user.id) : null;

  if (!user || !hash || !(await Bun.password.verify(password, hash))) {
    return { error: "Invalid email or password" };
  }

  const sessionId = Bun.randomUUIDv7();
  await saveSession({ sessionId, userId: user.id });

  ctx.response.cookies.set("session", sessionId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: true,
  });

  return redirect(next);
};
```

## Why redirect-after-success is preferred

A redirect keeps server truth authoritative and simplifies the client transition model:

- submit
- mutate on the server
- redirect to the canonical read route
- let the destination loader produce the fresh state

## Rules

- Use actions for writes, not loaders.
- Return plain validation payloads when you want to stay on the same page and read them from `useActionState`.
- Return `redirect()` when the mutation should land on another route.
- Stage cookies/headers through `ctx.response` and let the framework commit them onto the final response.
- Throw typed route errors when validation must bubble to a catch boundary.
- Prefer `<form action={formAction}>` over `<form method="post">` for page mutations.

## Related APIs

- [`Action`](/docs/api/react-bun-ssr-route)
- [`ActionContext`](/docs/api/react-bun-ssr-route)
- [`ActionResult`](/docs/api/react-bun-ssr-route)
- [`assertSameOriginAction`](/docs/api/react-bun-ssr)
- [`createRouteAction`](/docs/api/react-bun-ssr-route)
- [`redirect`](/docs/api/react-bun-ssr)
- [`sanitizeRedirectTarget`](/docs/api/react-bun-ssr)
- [`useRouteAction`](/docs/api/react-bun-ssr-route)

## Next step

Read [Error Handling](/docs/data/error-handling) to model validation and exceptional states precisely.
