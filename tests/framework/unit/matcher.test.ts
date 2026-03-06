import { describe, expect, it } from "bun:test";
import { matchClientPageRoute } from "../../../framework/runtime/client-transition-core";
import { matchApiRoute, matchPageRoute } from "../../../framework/runtime/matcher";

const pages = [
  {
    type: "page" as const,
    id: "users_new",
    filePath: "",
    routePath: "/users/new",
    segments: [
      { kind: "static" as const, value: "users" },
      { kind: "static" as const, value: "new" },
    ],
    score: 60,
    layoutFiles: [],
    middlewareFiles: [],
    directory: "users",
  },
  {
    type: "page" as const,
    id: "users_id",
    filePath: "",
    routePath: "/users/:id",
    segments: [
      { kind: "static" as const, value: "users" },
      { kind: "dynamic" as const, value: "id" },
    ],
    score: 50,
    layoutFiles: [],
    middlewareFiles: [],
    directory: "users",
  },
  {
    type: "page" as const,
    id: "docs_slug",
    filePath: "",
    routePath: "/docs/*slug",
    segments: [
      { kind: "static" as const, value: "docs" },
      { kind: "catchall" as const, value: "slug" },
    ],
    score: 31,
    layoutFiles: [],
    middlewareFiles: [],
    directory: "docs",
  },
];

describe("matcher", () => {
  it("matches dynamic params", () => {
    const match = matchPageRoute(pages, "/users/42");
    expect(match?.route.id).toBe("users_id");
    expect(match?.params.id).toBe("42");
  });

  it("respects route ranking for static routes", () => {
    const match = matchPageRoute(pages, "/users/new");
    expect(match?.route.id).toBe("users_new");
  });

  it("matches in declaration order when routes are unsorted", () => {
    const unsortedClientRoutes = [
      {
        id: "blog_slug",
        routePath: "/blog/:slug",
        segments: [
          { kind: "static" as const, value: "blog" },
          { kind: "dynamic" as const, value: "slug" },
        ],
        score: 50,
      },
      {
        id: "blog_new",
        routePath: "/blog/new",
        segments: [
          { kind: "static" as const, value: "blog" },
          { kind: "static" as const, value: "new" },
        ],
        score: 60,
      },
    ];

    const match = matchClientPageRoute(unsortedClientRoutes, "/blog/new");
    expect(match?.route.id).toBe("blog_slug");
  });

  it("matches catchall segments", () => {
    const match = matchPageRoute(pages, "/docs/a/b/c");
    expect(match?.params.slug).toBe("a/b/c");
  });

  it("matches API routes", () => {
    const apiRoutes = [
      {
        type: "api" as const,
        id: "api_hello_name",
        filePath: "",
        routePath: "/api/hello/:name",
        segments: [
          { kind: "static" as const, value: "api" },
          { kind: "static" as const, value: "hello" },
          { kind: "dynamic" as const, value: "name" },
        ],
        score: 80,
        middlewareFiles: [],
        directory: "api/hello",
      },
    ];

    const match = matchApiRoute(apiRoutes, "/api/hello/jane");
    expect(match?.params.name).toBe("jane");
  });
});
