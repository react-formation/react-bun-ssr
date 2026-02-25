import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "bun:test";
import { scanRoutes } from "../../framework/runtime/route-scanner";

const tempDirs: string[] = [];

afterAll(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function withFixture(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rbssr-routes-"));
  tempDirs.push(root);

  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf8");
  }

  return root;
}

describe("scanRoutes", () => {
  it("parses static, dynamic, and catchall routes", () => {
    const routesDir = withFixture({
      "index.tsx": "export default function Route(){return null}",
      "posts/[id].tsx": "export default function Route(){return null}",
      "docs/[...slug].tsx": "export default function Route(){return null}",
      "(group)/about.tsx": "export default function Route(){return null}",
      "api/hello.ts": "export function GET(){}",
      "_layout.tsx": "export default function Layout(){return null}",
      "posts/_middleware.ts": "export const middleware = async (ctx,next)=>next();",
    });

    const manifest = scanRoutes(routesDir);

    expect(manifest.pages.some(route => route.routePath === "/")).toBe(true);
    expect(manifest.pages.some(route => route.routePath === "/posts/:id")).toBe(true);
    expect(manifest.pages.some(route => route.routePath === "/docs/*slug")).toBe(true);
    expect(manifest.pages.some(route => route.routePath === "/about")).toBe(true);

    const postRoute = manifest.pages.find(route => route.routePath === "/posts/:id");
    expect(postRoute).toBeDefined();
    expect(postRoute?.layoutFiles.length).toBe(1);
    expect(postRoute?.middlewareFiles.length).toBe(1);

    expect(manifest.api.some(route => route.routePath === "/api/hello")).toBe(true);
  });

  it("ranks static routes above dynamic routes", () => {
    const routesDir = withFixture({
      "users/[id].tsx": "export default function Route(){return null}",
      "users/new.tsx": "export default function Route(){return null}",
    });

    const manifest = scanRoutes(routesDir);

    expect(manifest.pages[0]?.routePath).toBe("/users/new");
    expect(manifest.pages[1]?.routePath).toBe("/users/:id");
  });
});
