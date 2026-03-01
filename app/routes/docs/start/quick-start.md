---
title: Quick Start
navTitle: Quick Start
description: Build the first Task Tracker route tree, loader, action, and API endpoint with complete working files.
section: Start
order: 3
kind: guide
tags: quickstart,task-tracker,loader,action
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
import { redirect } from "react-bun-ssr";
import type { Action } from "react-bun-ssr/route";

export const action: Action = async ({ formData }) => {
  const title = String(formData?.get("title") ?? "").trim();
  if (!title) {
    return { error: "Title is required" };
  }

  return redirect("/tasks");
};

export default function NewTaskPage() {
  return (
    <form method="post">
      <label>
        Title
        <input name="title" />
      </label>
      <button type="submit">Save task</button>
    </form>
  );
}
```

```ts
// app/routes/api/tasks.ts
import { json } from "react-bun-ssr";

export function GET() {
  return json({ tasks: [{ id: "t1", title: "Write launch checklist" }] });
}
```

## Why this example matters

It already exercises the core runtime:

- a page loader for SSR data
- a form action for mutations
- soft navigation through `Link`
- a colocated API route

## What to notice

- `loader()` runs on the server and serializes its return value into the document payload.
- `action()` owns the POST request and can return plain data, redirects, or `Response` values.
- API routes live under the same `app/routes` tree but use HTTP method exports.

## Rules

- Keep page and API routes in the same route tree only when that improves locality.
- Use TypeScript interfaces at the route boundary so `useLoaderData()` stays explicit.
- Prefer redirect-after-success in actions instead of mutating client-only state first.

## Related APIs

- [`Loader`](/docs/api/react-bun-ssr-route)
- [`Action`](/docs/api/react-bun-ssr-route)
- [`json`](/docs/api/react-bun-ssr)
- [`redirect`](/docs/api/react-bun-ssr)

## Next step

Read [Project Structure](/docs/start/project-structure) before expanding the example into nested layouts and dynamic routes.
