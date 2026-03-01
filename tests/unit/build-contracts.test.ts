import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import {
  buildRouteManifest,
  createBuildManifest,
  generateClientEntries,
} from "../../framework/runtime/build-tools";
import { resolveConfig } from "../../framework/runtime/config";
import { readText } from "../../framework/runtime/io";
import { createFixtureApp } from "../helpers/fixture-app";
import { createTempDirRegistry } from "../helpers/temp-dir";

const tempDirs = createTempDirRegistry();

afterEach(async () => {
  await tempDirs.cleanup();
});

describe("build contracts", () => {
  it("generates one client entry per page route with root, layouts, and route wiring", async () => {
    const root = await createFixtureApp(tempDirs, {
      "app/root.tsx": `export default function Root(){ return null; }`,
      "app/routes/index.tsx": `export default function Index(){ return null; }`,
      "app/routes/dashboard/_layout.tsx": `export default function DashboardLayout(){ return null; }`,
      "app/routes/dashboard/reports.tsx": `export default function Reports(){ return null; }`,
    }, "rbssr-build-contracts-entries");

    const config = resolveConfig({ appDir: path.join(root, "app"), mode: "production" }, root);
    const manifest = await buildRouteManifest(config);
    const generatedDir = path.join(root, ".rbssr/generated/client-entries");
    const entries = await generateClientEntries({
      config,
      manifest,
      generatedDir,
    });

    expect(entries).toHaveLength(2);

    const reportsEntry = entries.find(entry => entry.routeId === "dashboard__reports");
    expect(reportsEntry).toBeDefined();
    const source = await readText(reportsEntry!.entryFilePath);
    expect(source).toContain('registerRouteModules("dashboard__reports", modules);');
    expect(source).toContain('hydrateInitialRoute("dashboard__reports");');
    expect(source).toContain('import RootDefault');
    expect(source).toContain('import Layout0Default');
    expect(source).toContain('import RouteDefault');
    expect(source).toContain('layouts: [{');
    expect(source).toContain('Loading: Layout0Module.Loading');
    expect(source).toContain('CatchBoundary: RouteModule.CatchBoundary');
    expect(source).not.toContain('{ ...Layout0Module, default: Layout0Default }');
    expect(source).not.toContain('{ ...RouteModule, default: RouteDefault }');
  });

  it("creates deterministic manifests and changes version when route assets change", () => {
    const baseAssets = {
      index: {
        script: "/client/route__index.js",
        css: ["/client/route__index.css"],
      },
    };

    const first = createBuildManifest(baseAssets);
    const second = createBuildManifest(baseAssets);
    const changed = createBuildManifest({
      ...baseAssets,
      index: {
        script: "/client/route__index-alt.js",
        css: ["/client/route__index.css"],
      },
    });

    expect(first.version).toBe(second.version);
    expect(first.version).not.toBe(changed.version);
  });

  it("includes markdown routes and excludes layout and middleware internals from the route manifest", async () => {
    const root = await createFixtureApp(tempDirs, {
      "app/root.tsx": `export default function Root(){ return null; }`,
      "app/routes/index.tsx": `export default function Index(){ return null; }`,
      "app/routes/guide.md": `# Guide\n\nNative markdown route.`,
      "app/routes/_layout.tsx": `export default function Layout(){ return null; }`,
      "app/routes/_middleware.ts": `export default async function middleware(ctx, next){ return next(); }`,
      "app/routes/api/hello.ts": `export function GET(){ return Response.json({ ok: true }); }`,
    }, "rbssr-build-contracts-manifest");

    const config = resolveConfig({ appDir: path.join(root, "app"), mode: "production" }, root);
    const manifest = await buildRouteManifest(config);

    expect(manifest.pages.map(route => route.id).sort()).toEqual(["guide", "index"]);
    expect(manifest.api.map(route => route.id)).toEqual(["api__hello"]);
  });
});
