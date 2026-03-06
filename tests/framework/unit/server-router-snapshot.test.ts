import { describe, expect, it } from "bun:test";
import { toClientRouteSnapshots } from "../../../framework/runtime/server";
import type { PageRouteDefinition } from "../../../framework/runtime/types";

describe("server router snapshot ordering", () => {
  it("normalizes page routes by specificity before hydration serialization", () => {
    const routes: PageRouteDefinition[] = [
      {
        type: "page",
        id: "blog_slug",
        filePath: "/app/routes/blog/[slug].tsx",
        routePath: "/blog/:slug",
        segments: [
          { kind: "static", value: "blog" },
          { kind: "dynamic", value: "slug" },
        ],
        score: 50,
        layoutFiles: [],
        middlewareFiles: [],
        directory: "blog",
      },
      {
        type: "page",
        id: "blog_new",
        filePath: "/app/routes/blog/new.tsx",
        routePath: "/blog/new",
        segments: [
          { kind: "static", value: "blog" },
          { kind: "static", value: "new" },
        ],
        score: 60,
        layoutFiles: [],
        middlewareFiles: [],
        directory: "blog",
      },
    ];

    const snapshots = toClientRouteSnapshots(routes);

    expect(snapshots.map(route => route.id)).toEqual(["blog_new", "blog_slug"]);
    expect(snapshots.map(route => route.routePath)).toEqual(["/blog/new", "/blog/:slug"]);
  });
});
