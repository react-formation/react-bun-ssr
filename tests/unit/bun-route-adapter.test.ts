import path from "node:path";
import { afterAll, describe, expect, it } from "bun:test";
import { createBunRouteAdapter } from "../../framework/runtime/bun-route-adapter";
import { ensureDir, makeTempDir, removePath } from "../../framework/runtime/io";

const tempDirs: string[] = [];

afterAll(async () => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    await removePath(dir);
  }
});

async function withFixture(files: Record<string, string>): Promise<string> {
  const root = await makeTempDir("rbssr-bun-router");
  tempDirs.push(root);

  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath);
    await ensureDir(path.dirname(absolutePath));
    await Bun.write(absolutePath, content);
  }

  return root;
}

function createAdapterDirs(root: string, label: string) {
  const suffix = Bun.randomUUIDv7();
  return {
    generatedMarkdownRootDir: path.join(root, ".rbssr/generated/markdown-routes", `${label}-${suffix}`),
    projectionRootDir: path.join(root, ".rbssr/generated/router-projection", `${label}-${suffix}`),
  };
}

describe("createBunRouteAdapter", () => {
  it("matches page and api routes with strict parity semantics", async () => {
    const root = await withFixture({
      "app/routes/index.tsx": "export default function Route(){return null}",
      "app/routes/(group)/about.tsx": "export default function Route(){return null}",
      "app/routes/users/[id].tsx": "export default function Route(){return null}",
      "app/routes/users/new.tsx": "export default function Route(){return null}",
      "app/routes/docs/[...slug].tsx": "export default function Route(){return null}",
      "app/routes/guide.md": "# Guide\n\nHello from markdown",
      "app/routes/api/hello.ts": "export function GET(){}",
      "app/routes/_layout.tsx": "export default function Layout(){return null}",
      "app/routes/users/_middleware.ts": "export const middleware = async (ctx,next)=>next();",
    });
    const routesDir = path.join(root, "app/routes");
    const adapterDirs = createAdapterDirs(root, "match");

    const adapter = await createBunRouteAdapter({
      routesDir,
      ...adapterDirs,
    });

    expect(adapter.manifest.pages.some(route => route.routePath === "/about")).toBe(true);
    expect(adapter.manifest.pages.some(route => route.routePath === "/guide")).toBe(true);

    expect(adapter.matchPage("/_layout")).toBeNull();

    const staticMatch = adapter.matchPage("/users/new");
    expect(staticMatch?.route.routePath).toBe("/users/new");

    const dynamicMatch = adapter.matchPage("/users/hello%20world");
    expect(dynamicMatch?.route.routePath).toBe("/users/:id");
    expect(dynamicMatch?.params.id).toBe("hello world");

    const catchallMatch = adapter.matchPage("/docs/a/b/c");
    expect(catchallMatch?.route.routePath).toBe("/docs/*slug");
    expect(catchallMatch?.params.slug).toBe("a/b/c");

    const markdownMatch = adapter.matchPage("/guide");
    expect(markdownMatch?.route.filePath.endsWith(".tsx")).toBe(true);

    const apiMatch = adapter.matchApi("/api/hello");
    expect(apiMatch?.route.routePath).toBe("/api/hello");
    expect(adapter.matchApi("/guide")).toBeNull();
  });

  it("rejects unsupported mdx routes with clear diagnostics", async () => {
    const root = await withFixture({
      "app/routes/index.tsx": "export default function Route(){return null}",
      "app/routes/guide.mdx": "# Not supported",
    });
    const routesDir = path.join(root, "app/routes");
    const adapterDirs = createAdapterDirs(root, "mdx");

    let message = "";
    try {
      await createBunRouteAdapter({
        routesDir,
        ...adapterDirs,
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain(".mdx route files are not supported yet");
  });

  it("throws when projection routes collide after route-group normalization", async () => {
    const root = await withFixture({
      "app/routes/about.tsx": "export default function Route(){return null}",
      "app/routes/(group)/about.tsx": "export default function Route(){return null}",
    });
    const routesDir = path.join(root, "app/routes");
    const adapterDirs = createAdapterDirs(root, "collision");

    let message = "";
    try {
      await createBunRouteAdapter({
        routesDir,
        ...adapterDirs,
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain("Route projection collision");
  });
});
