---
title: Quick Start: Build a Bun React SSR Task Tracker
navTitle: Quick Start
description: Build a Task Tracker with react-bun-ssr from route files to loaders, actions, shared layouts, and middleware using complete working code.
section: Start
order: 3
kind: guide
tags: quickstart,task-tracker,loader,action,layout,middleware
---

# Quick Start

This page builds the first useful version of the `Task Tracker` app. The goal is not to show every framework feature. The goal is to give you a route tree that already feels like production code.

## Minimal working example

```tsx
// app/routes/tasks/index.tsx
import { Link, useLoaderData } from "react-bun-ssr/route";

interface Task {
  id: string;
  title: string;
  done: boolean;
}

export async function loader() {
  const tasks: Task[] = [
    { id: "t1", title: "Write launch checklist", done: false },
    { id: "t2", title: "Review SSR output", done: true },
  ];

  return { tasks };
}

export default function TasksPage() {
  const data = useLoaderData<{ tasks: Task[] }>();

  return (
    <main>
      <h1>Task Tracker</h1>
      <p><Link to="/tasks/new">Create task</Link></p>
      <ul>
        {data.tasks.map(task => (
          <li key={task.id}>
            <Link to={`/tasks/${task.id}`}>{task.title}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

```tsx
// app/routes/tasks/new.tsx
import { useActionState } from "react";
import { createRouteAction } from "react-bun-ssr/route";

type NewTaskState = { error?: string };
export const action = createRouteAction<NewTaskState>();

export default function NewTaskPage() {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction}>
      {state.error ? <p>{state.error}</p> : null}
      <label>
        Title
        <input name="title" />
      </label>
      <button type="submit" disabled={pending}>Save task</button>
    </form>
  );
}
```

```tsx
// app/routes/tasks/new.server.tsx
import { redirect } from "react-bun-ssr";
import type { Action } from "react-bun-ssr/route";

type NewTaskState = { error?: string };

export const action: Action = async ({ formData }) => {
  const title = String(formData?.get("title") ?? "").trim();
  if (!title) {
    return { error: "Title is required" } satisfies NewTaskState;
  }

  // Real code should validate and persist the task here before redirecting.
  return redirect("/tasks");
};
```

```ts
// app/routes/api/tasks.ts
import { json } from "react-bun-ssr";

export function GET() {
  // Real code should load from your database or service layer here,
  // not return an inline array.
  return json({ tasks: [{ id: "t1", title: "Write launch checklist" }] });
}
```

## Why this example matters

It already exercises the core runtime:

- a page loader for SSR data
- a form action for mutations
- soft navigation through `Link`
- a colocated API route

## Add a shared tasks layout

Once the first route works, the next step is to stop repeating chrome across `/tasks`, `/tasks/new`, and future task pages.

```tsx
// app/routes/tasks/_layout.tsx
import { Link, Outlet } from "react-bun-ssr/route";

export default function TasksLayout() {
  return (
    <main>
      <header>
        <h1>Task Tracker</h1>
        <nav>
          <Link to="/tasks">All tasks</Link>
          <Link to="/tasks/new">Create task</Link>
        </nav>
      </header>
      <Outlet />
    </main>
  );
}
```

That keeps the task navigation mounted while leaf routes change underneath it.

At that point, the route tree looks like this:

```text
app/routes/
  tasks/
    _layout.tsx
    index.tsx
    new.tsx
  api/
    tasks.ts
```

## Add middleware for the tasks section

Use nested middleware when the behavior belongs to the `/tasks` subtree instead of the entire app.

```ts
// app/routes/tasks/_middleware.ts
import type { Middleware } from "react-bun-ssr/route";

export const middleware: Middleware = async (ctx, next) => {
  ctx.locals.section = "tasks";

  if (!ctx.cookies.get("session")) {
    return Response.redirect(new URL("/", ctx.url), 302);
  }

  return next();
};
```

Then the page loader can read the value that middleware attached:

```tsx
// app/routes/tasks/index.tsx
import { Link, useLoaderData, type Loader } from "react-bun-ssr/route";

interface Task {
  id: string;
  title: string;
  done: boolean;
}

export const loader: Loader = ({ locals }) => {
  const tasks: Task[] = [
    { id: "t1", title: "Write launch checklist", done: false },
    { id: "t2", title: "Review SSR output", done: true },
  ];

  return {
    section: locals.section,
    tasks,
  };
};

export default function TasksPage() {
  const data = useLoaderData<{ section: string; tasks: Task[] }>();

  return (
    <section>
      <p>Current section: {data.section}</p>
      <p><Link to="/tasks/new">Create task</Link></p>
      <ul>
        {data.tasks.map(task => (
          <li key={task.id}>
            <Link to={`/tasks/${task.id}`}>{task.title}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

## What this deeper version gives you

- one shared layout for the task area
- one nested middleware file for request policy and shared locals
- one place to grow into `/tasks/[id]`, `/tasks/completed`, or task-specific APIs

## What to notice

- `loader()` runs on the server and serializes its return value into the document payload.
- `action()` stays server-owned and is invoked from `useActionState(action, initialState)` with `createRouteAction()`.
- API routes live under the same `app/routes` tree but use HTTP method exports.
- `_layout.tsx` shares chrome without creating its own URL.
- `_middleware.ts` runs before the matched task routes and can populate `ctx.locals` or short-circuit the request.

## Rules

- Keep page and API routes in the same route tree only when that improves locality.
- Use TypeScript interfaces at the route boundary so `useLoaderData()` stays explicit.
- Prefer redirect-after-success in actions instead of mutating client-only state first.
- For page mutations, prefer `<form action={formAction}>` over `<form method="post">`.
- Use nested `_layout.tsx` when multiple sibling routes need the same shell.
- Use nested `_middleware.ts` when the behavior belongs to a route subtree instead of the whole app. 

## Related APIs

- [`Loader`](/docs/api/react-bun-ssr-route)
- [`Action`](/docs/api/react-bun-ssr-route)
- [`Outlet`](/docs/api/react-bun-ssr-route)
- [`Middleware`](/docs/api/react-bun-ssr-route)
- [`json`](/docs/api/react-bun-ssr)
- [`redirect`](/docs/api/react-bun-ssr)

## Next step

Read [Project Structure](/docs/start/project-structure), then go deeper with [Layouts and Groups](/docs/routing/layouts-and-groups) and [Middleware](/docs/routing/middleware).
