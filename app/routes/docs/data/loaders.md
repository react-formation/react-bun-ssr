---
title: Loaders
navTitle: Loaders
description: Fetch server data, return deferred values, and hydrate the same payload into the client route tree.
section: Data
order: 1
kind: guide
tags: loaders,defer,suspense,task-tracker
---

# Loaders

A loader runs for `GET` and `HEAD` requests and prepares the data for SSR, hydration, and client transitions.

## Minimal working example

```tsx
import { Suspense, use } from "react";
import { defer, useLoaderData, type Loader } from "react-bun-ssr/route";

interface TaskSummary {
  id: string;
  title: string;
}

export const loader: Loader = ({ url }) => {
  const status = url.searchParams.get("status") ?? "open";

  return defer({
    filter: status,
    tasks: Promise.resolve<TaskSummary[]>([
      { id: "t1", title: "Ship docs redesign" },
      { id: "t2", title: "Audit cache headers" },
    ]),
  });
};

function TaskList(props: { tasks: Promise<TaskSummary[]> }) {
  const tasks = use(props.tasks);
  return <ul>{tasks.map(task => <li key={task.id}>{task.title}</li>)}</ul>;
}

export default function TasksPage() {
  const data = useLoaderData<{
    filter: string;
    tasks: Promise<TaskSummary[]>;
  }>();

  return (
    <main>
      <h1>{data.filter} tasks</h1>
      <Suspense fallback={<p>Loading tasks…</p>}>
        <TaskList tasks={data.tasks} />
      </Suspense>
    </main>
  );
}
```

## Why loaders are central

The same loader contract drives:

- the first document request
- soft transitions through `<Link>`
- deferred streaming over HTML and transition channels

## Return model

A loader can return:

- plain serializable data
- `Response`
- `redirect()` output
- `defer({...})`
- typed caught errors like `routeError()` or `notFound()`

## Rules

- Keep deferred keys at the top level in v1.
- Use `Suspense` and `use()` for deferred values.
- If you need mutation semantics, switch to an action instead of overloading the loader.

## Related APIs

- [`Loader`](/docs/api/react-bun-ssr-route)
- [`LoaderContext`](/docs/api/react-bun-ssr-route)
- [`useLoaderData`](/docs/api/react-bun-ssr-route)
- [`defer`](/docs/api/react-bun-ssr-route)

## Next step

Handle mutations with [Actions](/docs/data/actions).
