import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import {
  createDevSnapshotTargets,
  createDevSnapshotConfig,
  createProductionServerEntrypointSource,
  createTestCommands,
  createTypecheckCommand,
  formatCliHelp,
  listStaleSnapshotVersions,
  parseFlags,
  readProjectEntries,
  resolveCliInvocation,
  shouldMirrorSnapshotEntry,
  shouldUseRequestTimeRebuildCheck,
} from "../../framework/cli/internal";
import { ensureDir, writeText } from "../../framework/runtime/io";
import type { ResolvedConfig } from "../../framework/runtime/types";
import { createTempDirRegistry } from "../helpers/temp-dir";

const tempDirs = createTempDirRegistry();

afterEach(async () => {
  await tempDirs.cleanup();
});

describe("cli internal helpers", () => {
  it("builds a package-safe production server entrypoint source", () => {
    const source = createProductionServerEntrypointSource();

    expect(source).toContain('from "react-bun-ssr"');
    expect(source).toContain('"dist/manifest.json"');
    expect(source).not.toContain('../../framework/runtime/index.ts');
  });

  it("creates snapshot config rooted in the mirrored app path and trims stale versions", () => {
    const resolved: ResolvedConfig = {
      cwd: "/repo",
      appDir: "/repo/app",
      routesDir: "/repo/app/routes",
      publicDir: "/repo/app/public",
      rootModule: "/repo/app/root.tsx",
      middlewareFile: "/repo/app/middleware.ts",
      distDir: "/repo/dist",
      host: "127.0.0.1",
      port: 3000,
      mode: "development",
      serverBytecode: true,
      headerRules: [],
    };

    const snapshotConfig = createDevSnapshotConfig(resolved, "/repo/.rbssr/dev/server-snapshots/v4");
    expect(snapshotConfig.appDir).toBe("/repo/.rbssr/dev/server-snapshots/v4/app");
    expect(snapshotConfig.routesDir).toBe("/repo/.rbssr/dev/server-snapshots/v4/app/routes");
    expect(snapshotConfig.rootModule).toBe("/repo/.rbssr/dev/server-snapshots/v4/app/root.tsx");
    expect(snapshotConfig.middlewareFile).toBe("/repo/.rbssr/dev/server-snapshots/v4/app/middleware.ts");

    expect(
      listStaleSnapshotVersions([
        { name: "v1", isDirectory: true, isFile: false },
        { name: "v2", isDirectory: true, isFile: false },
        { name: "v3", isDirectory: true, isFile: false },
        { name: "v4", isDirectory: true, isFile: false },
        { name: "notes.txt", isDirectory: false, isFile: true },
      ]),
    ).toEqual(["v1"]);
  });

  it("maps mirrored snapshot targets and request-time rebuild fallback decisions", () => {
    const targets = createDevSnapshotTargets("/repo", "/repo/.rbssr/dev/server-snapshots/v4", [
      { name: "app", isDirectory: true, isFile: false },
      { name: "docs", isDirectory: true, isFile: false },
      { name: "shared", isDirectory: true, isFile: false },
      { name: "package.json", isDirectory: false, isFile: true },
      { name: "framework", isDirectory: true, isFile: false },
      { name: "react-bun-ssr-0.1.0.tgz", isDirectory: false, isFile: true },
      { name: ".rbssr", isDirectory: true, isFile: false },
      { name: "dist", isDirectory: true, isFile: false },
      { name: "node_modules", isDirectory: true, isFile: false },
    ]);

    expect(targets).toEqual([
      {
        sourcePath: "/repo/app",
        snapshotPath: "/repo/.rbssr/dev/server-snapshots/v4/app",
        isDirectory: true,
        isFile: false,
      },
      {
        sourcePath: "/repo/docs",
        snapshotPath: "/repo/.rbssr/dev/server-snapshots/v4/docs",
        isDirectory: true,
        isFile: false,
      },
      {
        sourcePath: "/repo/shared",
        snapshotPath: "/repo/.rbssr/dev/server-snapshots/v4/shared",
        isDirectory: true,
        isFile: false,
      },
    ]);
    expect(shouldMirrorSnapshotEntry(".rbssr")).toBe(false);
    expect(shouldMirrorSnapshotEntry("dist")).toBe(false);
    expect(shouldMirrorSnapshotEntry("framework")).toBe(false);
    expect(shouldMirrorSnapshotEntry("package.json")).toBe(false);
    expect(shouldMirrorSnapshotEntry("react-bun-ssr-0.1.0.tgz")).toBe(false);
    expect(shouldMirrorSnapshotEntry("shared")).toBe(true);
    expect(shouldUseRequestTimeRebuildCheck(3, 3)).toBe(false);
    expect(shouldUseRequestTimeRebuildCheck(3, 2)).toBe(true);
  });

  it("reads project entries with directories and files", async () => {
    const root = await tempDirs.create("rbssr-cli-entries");
    await ensureDir(path.join(root, "app"));
    await writeText(path.join(root, "package.json"), "{}\n");

    const entries = await readProjectEntries(root);
    expect(entries).toEqual([
      {
        name: "app",
        isDirectory: true,
        isFile: false,
      },
      {
        name: "package.json",
        isDirectory: false,
        isFile: true,
      },
    ]);
  });

  it("parses force flags and produces stable delegated command lists", () => {
    expect(parseFlags(["--force"])).toEqual({ force: true });
    expect(parseFlags([])).toEqual({ force: false });
    expect(createTypecheckCommand()).toEqual(["bun", "x", "tsc", "--noEmit"]);
    expect(createTestCommands(["tests/unit"])).toEqual([["bun", "test", "tests/unit"]]);
    expect(createTestCommands([])).toEqual([
      ["bun", "test", "./tests/unit"],
      ["bun", "test", "./tests/integration"],
      ["bun", "x", "playwright", "test"],
    ]);
  });

  it("keeps help and unknown command routing stable", () => {
    expect(formatCliHelp()).toContain("rbssr init [--force]");
    expect(resolveCliInvocation([])).toEqual({ kind: "help" });
    expect(resolveCliInvocation(["--help"])).toEqual({ kind: "help" });
    expect(resolveCliInvocation(["build"])).toEqual({
      kind: "command",
      command: "build",
      args: [],
    });
    expect(resolveCliInvocation(["wat"])).toEqual({
      kind: "unknown",
      command: "wat",
    });
  });
});
