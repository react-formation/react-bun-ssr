import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import {
  createDevSnapshotConfig,
  createDevSnapshotTargets,
  listStaleSnapshotVersions,
} from "../../framework/cli/internal";
import { copyDirRecursive } from "../../framework/runtime/build-tools";
import { ensureDir, existsPath, writeText } from "../../framework/runtime/io";
import { createFixtureApp } from "../helpers/fixture-app";
import { createTempDirRegistry } from "../helpers/temp-dir";

const tempDirs = createTempDirRegistry();

afterEach(async () => {
  await tempDirs.cleanup();
});

describe("CLI dev snapshot behavior", () => {
  it("mirrors project sources into versioned snapshot directories and trims stale versions", async () => {
    const root = await createFixtureApp(tempDirs, {
      "app/root.tsx": `export default function Root(){ return <main />; }`,
      "app/routes/index.tsx": `export default function Index(){ return <h1>home</h1>; }`,
      "docs/guide.md": "# Guide",
      "shared/env.ts": `export const env = "dev";`,
    }, "rbssr-cli-snapshot");

    const snapshotsRoot = path.join(root, ".rbssr/dev/server-snapshots");
    const snapshotDir = path.join(snapshotsRoot, "v4");
    await ensureDir(snapshotDir);

    const targets = createDevSnapshotTargets(root, snapshotDir, [
      { name: "app", isDirectory: true, isFile: false },
      { name: "docs", isDirectory: true, isFile: false },
      { name: "shared", isDirectory: true, isFile: false },
    ]);
    for (const target of targets) {
      await copyDirRecursive(target.sourcePath, target.snapshotPath);
    }

    expect(await existsPath(path.join(snapshotDir, "app/root.tsx"))).toBe(true);
    expect(await existsPath(path.join(snapshotDir, "app/routes/index.tsx"))).toBe(true);
    expect(await existsPath(path.join(snapshotDir, "docs/guide.md"))).toBe(true);
    expect(await existsPath(path.join(snapshotDir, "shared/env.ts"))).toBe(true);

    const snapshotConfig = createDevSnapshotConfig(
      {
        cwd: root,
        appDir: path.join(root, "app"),
        routesDir: path.join(root, "app/routes"),
        publicDir: path.join(root, "app/public"),
        rootModule: path.join(root, "app/root.tsx"),
        middlewareFile: path.join(root, "app/middleware.ts"),
        distDir: path.join(root, "dist"),
        host: "127.0.0.1",
        port: 3000,
        mode: "development",
        serverBytecode: true,
        headerRules: [],
      },
      snapshotDir,
    );
    expect(snapshotConfig.appDir).toBe(path.join(snapshotDir, "app"));
    expect(snapshotConfig.routesDir).toBe(path.join(snapshotDir, "app/routes"));

    const versionEntries = [];
    for (const dirName of ["v1", "v2", "v3", "v4"]) {
      await ensureDir(path.join(snapshotsRoot, dirName));
      await writeText(path.join(snapshotsRoot, dirName, "root.tsx"), `// ${dirName}\n`);
      versionEntries.push({
        name: dirName,
        isDirectory: true,
        isFile: false,
      });
    }

    const stale = listStaleSnapshotVersions(versionEntries);
    expect(stale).toEqual(["v1"]);
  });
});
