import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import { runBuild, runInit, runStart } from "../../framework/cli/commands";
import { ensureDir, existsPath, readText } from "../../framework/runtime/io";
import { createFixtureApp } from "../helpers/fixture-app";
import { createTempDirRegistry } from "../helpers/temp-dir";

const tempDirs = createTempDirRegistry();

function linkDirectory(target: string, linkPath: string): void {
  const result = Bun.spawnSync({
    cmd: ["ln", "-s", target, linkPath],
    stdout: "pipe",
    stderr: "pipe",
  });

  if (result.exitCode !== 0) {
    const stderr = result.stderr.length > 0 ? new TextDecoder().decode(result.stderr).trim() : "";
    throw new Error(`Failed to create symlink ${linkPath} -> ${target}: ${stderr || result.exitCode}`);
  }
}

afterEach(async () => {
  await tempDirs.cleanup();
});

describe("CLI build/start contracts", () => {
  it("scaffolds a new app with init", async () => {
    const root = await tempDirs.create("rbssr-cli-init");

    await runInit([], root);

    for (const relativePath of [
      "rbssr.config.ts",
      "app/root.tsx",
      "app/middleware.ts",
      "app/routes/index.tsx",
      "app/routes/api/health.ts",
    ]) {
      expect(await existsPath(path.join(root, relativePath))).toBe(true);
    }
  });

  it("builds client and server artifacts with a package-safe server entrypoint", async () => {
    const root = await createFixtureApp(tempDirs, {
      "rbssr.config.ts": `
        export default { appDir: "app", port: 3201 };
      `,
      "app/root.tsx": `
        import { Outlet } from "react-bun-ssr/route";
        export default function Root(){ return <main><Outlet /></main>; }
      `,
      "app/routes/index.tsx": `export default function Index(){ return <h1>home</h1>; }`,
      "app/public/logo.txt": "logo",
    }, "rbssr-cli-build");

    const nodeModulesDir = path.join(root, "node_modules");
    await ensureDir(nodeModulesDir);
    linkDirectory(process.cwd(), path.join(nodeModulesDir, "react-bun-ssr"));
    linkDirectory(path.join(process.cwd(), "node_modules", "react"), path.join(nodeModulesDir, "react"));
    linkDirectory(path.join(process.cwd(), "node_modules", "react-dom"), path.join(nodeModulesDir, "react-dom"));

    await runBuild(root);

    expect(await existsPath(path.join(root, "dist/manifest.json"))).toBe(true);
    expect(await existsPath(path.join(root, "dist/server/server.mjs"))).toBe(true);
    expect(await existsPath(path.join(root, "dist/client/logo.txt"))).toBe(true);

    const manifest = JSON.parse(await readText(path.join(root, "dist/manifest.json"))) as {
      routes: Record<string, { script: string; css: string[] }>;
    };
    expect(manifest.routes.index).toBeDefined();
    expect(manifest.routes.index!.script.startsWith("/client/")).toBe(true);

    const serverEntry = await readText(path.join(root, "dist/server/server.mjs"));
    expect(serverEntry).toContain('from "react-bun-ssr"');
    expect(serverEntry).not.toContain("../../framework/runtime/index.ts");
  });

  it("throws a clear error when start runs before build", async () => {
    const root = await createFixtureApp(tempDirs, {
      "rbssr.config.ts": `
        export default { appDir: "app" };
      `,
      "app/root.tsx": `export default function Root(){ return <main />; }`,
      "app/routes/index.tsx": `export default function Index(){ return <h1>home</h1>; }`,
    }, "rbssr-cli-start");

    await expect(runStart(root)).rejects.toThrow("Missing dist/server/server.mjs");
  });
});
