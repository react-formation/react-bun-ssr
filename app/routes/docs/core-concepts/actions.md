---
title: Actions and mutation flow
description: Form and JSON mutation handling through route action functions.
section: Core Concepts
order: 4
tags: action,forms,mutation
---

# Actions and mutation flow

`action` executes for `POST`, `PUT`, `PATCH`, and `DELETE`.

## Example

```tsx
import { redirect } from "react-bun-ssr";

export async function action({ formData }: { formData?: FormData }) {
  const title = formData?.get("title");
  if (!title) {
    return { error: "title is required" };
  }

  // Persist to DB here.
  return redirect("/docs/core-concepts/actions");
}

export default function CreateRoute() {
  return (
    <form method="post">
      <input name="title" placeholder="Title" />
      <button type="submit">Create</button>
    </form>
  );
}
```

## Body parsing

- `application/json` -> `ctx.json`
- `multipart/form-data` and `application/x-www-form-urlencoded` -> `ctx.formData`

## Typical pattern

Return `redirect("/next")` after successful mutation.

You can also throw caught errors from actions with `routeError(...)` or `notFound(...)` to render `CatchBoundary`/`NotFound` without crashing the app shell.
