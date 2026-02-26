import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import {
  buildRouteManifest,
  bundleClientEntries,
  generateClientEntries,
} from "../../framework/runtime/build-tools";
import { resolveConfig } from "../../framework/runtime/config";
import { ensureDir, existsPath, makeTempDir, removePath } from "../../framework/runtime/io";

const tmpDirs: string[] = [];

afterEach(async () => {
  for (const dir of tmpDirs.splice(0, tmpDirs.length)) {
    await removePath(dir);
  }
});

async function writeFixture(root: string, files: Record<string, string>): Promise<void> {
  await Promise.all(
    Object.entries(files).map(async ([relativePath, content]) => {
      const filePath = path.join(root, relativePath);
      await ensureDir(path.dirname(filePath));
      await Bun.write(filePath, content);
    }),
  );
}

describe("bundleClientEntries CSS mapping", () => {
  it("maps shared cssBundle to every route manifest entry", async () => {
    const root = await makeTempDir("rbssr-build-tools");
    tmpDirs.push(root);

    await writeFixture(root, {
      "app/root.tsx": `import "./root.module.css";
export default function Root() {
  return null;
}`,
      "app/root.module.css": `.shell { color: rgb(17, 31, 45); }`,
      "app/routes/index.tsx": `export default function Index() { return null; }`,
      "app/routes/about.tsx": `export default function About() { return null; }`,
    });

    const config = resolveConfig(
      {
        appDir: path.join(root, "app"),
        mode: "production",
      },
      root,
    );
    const manifest = await buildRouteManifest(config);
    const generatedDir = path.join(root, ".rbssr/generated/client-entries");
    const outDir = path.join(root, "dist/client");

    const entries = await generateClientEntries({
      config,
      manifest,
      generatedDir,
    });

    const routeAssets = await bundleClientEntries({
      entries,
      outDir,
      dev: false,
      publicPrefix: "/client/",
    });

    expect(routeAssets.index).toBeDefined();
    expect(routeAssets.about).toBeDefined();
    expect(routeAssets.index?.css.length).toBeGreaterThan(0);
    expect(routeAssets.about?.css.length).toBeGreaterThan(0);
    expect(routeAssets.index?.css[0]).toBe(routeAssets.about?.css[0]);

    const cssRelativePath = routeAssets.index?.css[0]?.replace("/client/", "");
    expect(cssRelativePath).toBeTruthy();
    expect(await existsPath(path.join(outDir, cssRelativePath!))).toBe(true);
  });
});
