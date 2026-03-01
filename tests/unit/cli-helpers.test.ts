import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import {
  createDevHotEntrypointSource,
  createProductionServerEntrypointSource,
  createTestCommands,
  createTypecheckCommand,
  formatCliHelp,
  parseFlags,
  RBSSR_DEV_RESTART_EXIT_CODE,
  readProjectEntries,
  resolveCliInvocation,
} from "../../framework/cli/internal";
import { ensureDir, writeText } from "../../framework/runtime/io";
import { createTempDirRegistry } from "../helpers/temp-dir";

const tempDirs = createTempDirRegistry();

afterEach(async () => {
  await tempDirs.cleanup();
});

describe("cli internal helpers", () => {
  it("builds package-safe production and dev entrypoints", () => {
    const productionSource = createProductionServerEntrypointSource();
    expect(productionSource).toContain('from "react-bun-ssr"');
    expect(productionSource).toContain('"dist/manifest.json"');
    expect(productionSource).not.toContain("../../framework/runtime/index.ts");

    const devSource = createDevHotEntrypointSource({
      cwd: "/repo",
      runtimeModulePath: "/repo/framework/cli/dev-runtime.ts",
    });
    expect(devSource).toContain('from "/repo/framework/cli/dev-runtime.ts"');
    expect(devSource).toContain('process.chdir("/repo")');
    expect(devSource).toContain("runHotDevChild");
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

  it("parses flags and exposes delegated command contracts", () => {
    expect(parseFlags(["--force"])).toEqual({ force: true });
    expect(parseFlags([])).toEqual({ force: false });
    expect(createTypecheckCommand()).toEqual(["bun", "x", "tsc", "--noEmit"]);
    expect(createTestCommands(["tests/unit"])).toEqual([["bun", "test", "tests/unit"]]);
    expect(createTestCommands([])).toEqual([
      ["bun", "test", "./tests/unit"],
      ["bun", "test", "./tests/integration"],
      ["bun", "x", "playwright", "test"],
    ]);
    expect(RBSSR_DEV_RESTART_EXIT_CODE).toBe(75);
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
