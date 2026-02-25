import path from "node:path";
import { afterAll, describe, expect, it } from "bun:test";
import { ensureDir, makeTempDir, removePath } from "../../framework/runtime/io";
import { scanRoutes } from "../../framework/runtime/route-scanner";

const tempDirs: string[] = [];

afterAll(async () => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    await removePath(dir);
  }
});

async function withFixture(files: Record<string, string>): Promise<string> {
  const root = await makeTempDir("rbssr-routes");
  tempDirs.push(root);

  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, relative);
    await ensureDir(path.dirname(target));
    await Bun.write(target, content);
  }

  return root;
}

describe("scanRoutes", () => {
  it("parses static, dynamic, and catchall routes", async () => {
    const routesDir = await withFixture({
      "index.tsx": "export default function Route(){return null}",
      "guide.md": "# Guide\n\nHello markdown",
      "posts/[id].tsx": "export default function Route(){return null}",
      "docs/[...slug].tsx": "export default function Route(){return null}",
      "(group)/about.tsx": "export default function Route(){return null}",
      "api/hello.ts": "export function GET(){}",
      "_layout.tsx": "export default function Layout(){return null}",
      "posts/_middleware.ts": "export const middleware = async (ctx,next)=>next();",
    });

    const manifest = await scanRoutes(routesDir);

    expect(manifest.pages.some(route => route.routePath === "/")).toBe(true);
    expect(manifest.pages.some(route => route.routePath === "/guide")).toBe(true);
    expect(manifest.pages.some(route => route.routePath === "/posts/:id")).toBe(true);
    expect(manifest.pages.some(route => route.routePath === "/docs/*slug")).toBe(true);
    expect(manifest.pages.some(route => route.routePath === "/about")).toBe(true);

    const markdownRoute = manifest.pages.find(route => route.routePath === "/guide");
    expect(markdownRoute).toBeDefined();
    expect(markdownRoute?.filePath.endsWith(".tsx")).toBe(true);

    const postRoute = manifest.pages.find(route => route.routePath === "/posts/:id");
    expect(postRoute).toBeDefined();
    expect(postRoute?.layoutFiles.length).toBe(1);
    expect(postRoute?.middlewareFiles.length).toBe(1);

    expect(manifest.api.some(route => route.routePath === "/api/hello")).toBe(true);
  });

  it("ranks static routes above dynamic routes", async () => {
    const routesDir = await withFixture({
      "users/[id].tsx": "export default function Route(){return null}",
      "users/new.tsx": "export default function Route(){return null}",
    });

    const manifest = await scanRoutes(routesDir);

    expect(manifest.pages[0]?.routePath).toBe("/users/new");
    expect(manifest.pages[1]?.routePath).toBe("/users/:id");
  });

  it("rejects unsupported mdx page routes with a clear error", async () => {
    const routesDir = await withFixture({
      "index.tsx": "export default function Route(){return null}",
      "guide.mdx": "# MDX\n",
    });

    let message = "";
    try {
      await scanRoutes(routesDir);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain(".mdx route files are not supported yet");
  });
});
