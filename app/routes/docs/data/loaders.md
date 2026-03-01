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

## Using `defer()`

Use `defer()` when part of the page is critical for the first render and another part can resolve after the document starts streaming.

```tsx
import { Suspense, use } from "react";
import { defer, useLoaderData, type Loader } from "react-bun-ssr/route";

interface Task {
  id: string;
  title: string;
}

export const loader: Loader = async () => {
  const critical = {
    heading: "Tasks",
    totalOpen: 12,
  };

  const slowTasks = Promise.resolve<Task[]>([
    { id: "t1", title: "Ship transitions" },
    { id: "t2", title: "Document defer()" },
  ]);

  return defer({
    critical,
    slowTasks,
  });
};

function SlowTaskList(props: { tasks: Promise<Task[]> }) {
  const tasks = use(props.tasks);
  return <ul>{tasks.map(task => <li key={task.id}>{task.title}</li>)}</ul>;
}

export default function TasksPage() {
  const data = useLoaderData<{
    critical: {
      heading: string;
      totalOpen: number;
    };
    slowTasks: Promise<Task[]>;
  }>();

  return (
    <main>
      <h1>{data.critical.heading}</h1>
      <p>Open tasks: {data.critical.totalOpen}</p>
      <Suspense fallback={<p>Loading task list…</p>}>
        <SlowTaskList tasks={data.slowTasks} />
      </Suspense>
    </main>
  );
}
```

## What `defer()` does

`defer()` marks the loader result as partially deferred.

- Immediate keys are serialized into the first payload and available during the first render.
- Promise keys become deferred values and resolve later through the streaming protocol.
- On the client, `useLoaderData()` gives you the same shape back, with deferred keys revived as promises that React `use()` can consume.

## Loader with or without `defer()`

The difference is whether the loader must finish everything before the page renders.

Without `defer()`:

- the loader waits for every async value
- the first HTML render is blocked until all data is ready
- `useLoaderData()` returns only resolved values

```tsx
export const loader: Loader = async () => {
  const tasks = await fetchTasks();
  const analytics = await fetchAnalytics();

  return { tasks, analytics };
};
```

With `defer()`:

- immediate keys render first
- deferred promise keys resolve after the document starts streaming
- `useLoaderData()` returns a mixed object with plain values and promises
- deferred keys are consumed with React `use()` inside `Suspense`

```tsx
export const loader: Loader = () => {
  return defer({
    title: "Dashboard",
    analytics: fetchAnalytics(),
  });
};
```

Rule of thumb:

- use a normal loader when the page is not useful until all data is ready
- use `defer()` when one slow part should not block the initial render

## When to use it

Use `defer()` when:

- above-the-fold content can render without waiting for every request
- one slow query should not block the whole document
- you want `Suspense` fallbacks during SSR and client transitions

Do not use it when:

- every field is required before the page can render correctly
- the deferred value is not JSON-serializable when it resolves
- you are trying to hide mutation logic that belongs in an action

## Rules

- Keep deferred keys at the top level in v1.
- Use `Suspense` and `use()` for deferred values.
- Deferred values still need to resolve to serializable data.
- Rejected deferred promises bubble to the nearest error boundary.
- If you need mutation semantics, switch to an action instead of overloading the loader.

## Related APIs

- [`Loader`](/docs/api/react-bun-ssr-route)
- [`LoaderContext`](/docs/api/react-bun-ssr-route)
- [`useLoaderData`](/docs/api/react-bun-ssr-route)
- [`defer`](/docs/api/react-bun-ssr-route)

## Next step

Handle mutations with [Actions](/docs/data/actions).
