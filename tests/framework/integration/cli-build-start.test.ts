import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import { runBuild, runInit, runStart } from "../../../framework/cli/commands";
import { existsPath, readText } from "../../../framework/runtime/io";
import { createFixtureApp } from "../helpers/fixture-app";
import { runProcess, spawnProcess, waitForHttpReady } from "../helpers/process";
import { createTempDirRegistry } from "../helpers/temp-dir";

const tempDirs = createTempDirRegistry();
const rbssrBinPath = path.resolve(import.meta.dir, "../../../bin/rbssr.ts");
let activeProcess: Bun.Subprocess | null = null;

afterEach(async () => {
  if (activeProcess) {
    activeProcess.kill();
    await activeProcess.exited;
    activeProcess = null;
  }

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
    expect(serverEntry).not.toContain("../../../framework/runtime/index.ts");
  });

  it("forces production builds even when NODE_ENV is development", async () => {
    const root = await createFixtureApp(tempDirs, {
      "rbssr.config.ts": `
        export default { appDir: "app", port: 3202 };
      `,
      "app/root.tsx": `
        import { Outlet } from "react-bun-ssr/route";
        export default function Root(){ return <main><Outlet /></main>; }
      `,
      "app/routes/index.tsx": `
        export default function Index(){ return <h1>{process.env.NODE_ENV}</h1>; }
        export function head(){ return <title>{process.env.NODE_ENV}</title>; }
      `,
    }, "rbssr-cli-build-prod");

    const buildResult = await runProcess({
      cmd: ["bun", rbssrBinPath, "build"],
      cwd: root,
      env: {
        NODE_ENV: "development",
      },
    });

    if (buildResult.exitCode !== 0) {
      throw new Error(`rbssr build failed:\n${buildResult.stderr || buildResult.stdout}`);
    }

    const manifest = JSON.parse(await readText(path.join(root, "dist/manifest.json"))) as {
      routes: Record<string, { script: string; css: string[] }>;
    };

    expect(manifest.routes.index).toBeDefined();
    expect(manifest.routes.index!.script).toMatch(/^\/client\/route__index-[A-Za-z0-9]+\.(?:js|mjs)$/);

    activeProcess = spawnProcess({
      cmd: ["bun", rbssrBinPath, "start"],
      cwd: root,
      env: {
        NODE_ENV: "development",
      },
      stdout: "ignore",
      stderr: "pipe",
    });

    await waitForHttpReady("http://127.0.0.1:3202");

    const html = await fetch("http://127.0.0.1:3202/").then(response => response.text());
    expect(html).toContain("<title>production</title>");
    expect(html).toContain(">production</h1>");
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
