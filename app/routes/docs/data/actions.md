---
title: Actions
navTitle: Actions
description: Process mutating requests, validate form data, redirect after success, and keep Task Tracker writes server-owned.
section: Data
order: 2
kind: guide
tags: actions,forms,redirects,mutations
---

# Actions

Actions handle non-GET mutations. In the `Task Tracker`, creating or updating a task belongs here.

## Minimal working example

```tsx
import { redirect } from "react-bun-ssr";
import type { Action } from "react-bun-ssr/route";

export const action: Action = async ({ formData }) => {
  const title = String(formData?.get("title") ?? "").trim();
  const assignee = String(formData?.get("assignee") ?? "").trim();

  if (!title) {
    return { error: "Title is required" };
  }

  await Promise.resolve({ title, assignee });
  return redirect("/tasks");
};

export default function NewTaskPage() {
  return (
    <form method="post">
      <input name="title" placeholder="Ship docs redesign" />
      <input name="assignee" placeholder="Owner" />
      <button type="submit">Create task</button>
    </form>
  );
}
```

## Why redirect-after-success is preferred

A redirect keeps server truth authoritative and simplifies the client transition model:

- submit
- mutate on the server
- redirect to the canonical read route
- let the destination loader produce the fresh state

## Rules

- Use actions for writes, not loaders.
- Return plain validation payloads when you want to stay on the same page.
- Return `redirect()` when the mutation should land on another route.
- Throw typed route errors when validation must bubble to a catch boundary.

## Related APIs

- [`Action`](/docs/api/react-bun-ssr-route)
- [`ActionContext`](/docs/api/react-bun-ssr-route)
- [`ActionResult`](/docs/api/react-bun-ssr-route)
- [`redirect`](/docs/api/react-bun-ssr)

## Next step

Read [Error Handling](/docs/data/error-handling) to model validation and exceptional states precisely.
