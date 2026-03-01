import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import { createBunRouteAdapter } from "../../framework/runtime/bun-route-adapter";
import { matchClientPageRoute } from "../../framework/runtime/client-transition-core";
import { matchPageRoute } from "../../framework/runtime/matcher";
import type { Params } from "../../framework/runtime/types";
import { createFixtureApp } from "../helpers/fixture-app";
import { createTempDirRegistry } from "../helpers/temp-dir";

const tempDirs = createTempDirRegistry();

afterEach(async () => {
  await tempDirs.cleanup();
});

describe("route matching parity", () => {
  it("keeps Bun router, shared matcher, and client matcher aligned", async () => {
    const root = await createFixtureApp(tempDirs, {
      "app/routes/index.tsx": "export default function Index(){ return <h1>home</h1>; }",
      "app/routes/about.tsx": "export default function About(){ return <h1>about</h1>; }",
      "app/routes/tasks/new.tsx": "export default function TaskNew(){ return <h1>new</h1>; }",
      "app/routes/tasks/[id].tsx": "export default function Task(){ return <h1>task</h1>; }",
      "app/routes/docs/[...slug].tsx": "export default function Docs(){ return <h1>docs</h1>; }",
      "app/routes/tags/[name].tsx": "export default function Tag(){ return <h1>tag</h1>; }",
    }, "rbssr-route-parity");

    const adapter = await createBunRouteAdapter({
      routesDir: path.join(root, "app/routes"),
      generatedMarkdownRootDir: path.join(root, ".rbssr/generated/markdown-routes"),
      projectionRootDir: path.join(root, ".rbssr/generated/router-projection/route-parity"),
    });
    const clientRoutes = adapter.manifest.pages.map(route => ({
      id: route.id,
      routePath: route.routePath,
      segments: route.segments,
      score: route.score,
    }));

    const cases: Array<{ pathname: string; routeId: string; params: Params }> = [
      { pathname: "/", routeId: "index", params: {} },
      { pathname: "/about", routeId: "about", params: {} },
      { pathname: "/about/", routeId: "about", params: {} },
      { pathname: "/tasks/new", routeId: "tasks__new", params: {} },
      { pathname: "/tasks/42", routeId: "tasks__param_id", params: { id: "42" } },
      { pathname: "/docs/guides/install", routeId: "docs__catchall_slug", params: { slug: "guides/install" } },
      { pathname: "/tags/hello%20world", routeId: "tags__param_name", params: { name: "hello world" } },
    ];

    for (const testCase of cases) {
      const bunMatch = adapter.matchPage(testCase.pathname);
      const sharedMatch = matchPageRoute(adapter.manifest.pages, testCase.pathname);
      const clientMatch = matchClientPageRoute(clientRoutes, testCase.pathname);

      expect(bunMatch?.route.id).toBe(testCase.routeId);
      expect(sharedMatch?.route.id).toBe(testCase.routeId);
      expect(clientMatch?.route.id).toBe(testCase.routeId);
      expect(bunMatch?.params).toEqual(testCase.params);
      expect(sharedMatch?.params).toEqual(testCase.params);
      expect(clientMatch?.params).toEqual(testCase.params);
    }

    expect(adapter.matchPage("/missing")).toBeNull();
    expect(matchPageRoute(adapter.manifest.pages, "/missing")).toBeNull();
    expect(matchClientPageRoute(clientRoutes, "/missing")).toBeNull();
  });
});
