import path from "node:path";
import { afterEach, describe, expect, it, setDefaultTimeout } from "bun:test";
import { ensureDir, existsPath, writeText } from "../../../framework/runtime/io";
import { createFixtureApp } from "../helpers/fixture-app";
import { canListenOnLoopback, getAvailablePort, spawnProcess, waitForHttpReady } from "../helpers/process";
import { createTempDirRegistry } from "../helpers/temp-dir";

const tempDirs = createTempDirRegistry();
const rbssrBinPath = path.resolve(import.meta.dir, "../../../bin/rbssr.ts");

let activeProcess: Bun.Subprocess | null = null;
const describeWhenLoopback = (await canListenOnLoopback()) ? describe : describe.skip;

setDefaultTimeout(40_000);

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
  if (activeProcess) {
    activeProcess.kill();
    await activeProcess.exited;
    activeProcess = null;
  }

  await tempDirs.cleanup();
});

describeWhenLoopback("CLI dev runtime", () => {
  it("starts without creating versioned server snapshots and can restart from existing generated entries", async () => {
    const port = await getAvailablePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const root = await createFixtureApp(tempDirs, {
      "rbssr.config.ts": `export default { appDir: "app", port: ${port} };`,
      "app/root.tsx": `export default function Root(){ return <main>root</main>; }`,
      "app/routes/index.tsx": `export default function Index(){ return <h1>home</h1>; }`,
    }, "rbssr-cli-dev-hot");

    activeProcess = spawnProcess({
      cmd: ["bun", rbssrBinPath, "dev"],
      cwd: root,
      stdout: "ignore",
      stderr: "ignore",
    });

    await waitForHttpReady(baseUrl, { timeoutMs: 30_000 });

    expect(await existsPath(path.join(root, ".rbssr/generated/dev/entry.ts"))).toBe(true);
    expect(await existsPath(path.join(root, ".rbssr/dev/server-snapshots"))).toBe(false);

    activeProcess.kill();
    await activeProcess.exited;
    activeProcess = null;

    activeProcess = spawnProcess({
      cmd: ["bun", rbssrBinPath, "dev"],
      cwd: root,
      stdout: "ignore",
      stderr: "ignore",
    });

    await waitForHttpReady(baseUrl, { timeoutMs: 30_000 });
  });

  it("starts when app/node_modules contains a linked framework cycle", async () => {
    const port = await getAvailablePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const root = await createFixtureApp(tempDirs, {
      "rbssr.config.ts": `export default { appDir: "app", port: ${port} };`,
      "app/root.tsx": `export default function Root(){ return <main>root</main>; }`,
      "app/routes/index.tsx": `export default function Index(){ return <h1>home</h1>; }`,
    }, "rbssr-cli-dev-linked-app");

    const appNodeModulesDir = path.join(root, "app/node_modules");
    await ensureDir(appNodeModulesDir);
    linkDirectory(root, path.join(appNodeModulesDir, "react-bun-ssr"));

    activeProcess = spawnProcess({
      cmd: ["bun", rbssrBinPath, "dev"],
      cwd: root,
      stdout: "ignore",
      stderr: "ignore",
    });

    await waitForHttpReady(baseUrl, { timeoutMs: 30_000 });
  });

  it("reloads server runtime when *.server route companions change", async () => {
    const port = await getAvailablePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const root = await createFixtureApp(tempDirs, {
      "rbssr.config.ts": `export default { appDir: "app", port: ${port} };`,
      "app/root.tsx": `
        import { Outlet } from "react-bun-ssr/route";
        export default function Root(){ return <main><Outlet /></main>; }
      `,
      "app/routes/index.tsx": `
        import { useLoaderData } from "react-bun-ssr/route";
        export default function Index(){
          const data = useLoaderData<{ message: string }>();
          return <h1>{data.message}</h1>;
        }
      `,
      "app/routes/index.server.tsx": `
        export function loader(){ return { message: "v1" }; }
      `,
    }, "rbssr-cli-dev-server-only-reload");

    activeProcess = spawnProcess({
      cmd: ["bun", rbssrBinPath, "dev"],
      cwd: root,
      stdout: "ignore",
      stderr: "ignore",
    });

    await waitForHttpReady(baseUrl, { timeoutMs: 30_000 });
    const firstHtml = await fetch(`${baseUrl}/`).then(response => response.text());
    expect(firstHtml).toContain("v1");

    await writeText(
      path.join(root, "app/routes/index.server.tsx"),
      `export function loader(){ return { message: "v2" }; }\n`,
    );

    const startedAt = Date.now();
    while (Date.now() - startedAt < 20_000) {
      const html = await fetch(`${baseUrl}/`).then(response => response.text());
      if (html.includes("v2")) {
        return;
      }
      await Bun.sleep(120);
    }

    throw new Error("Timed out waiting for server companion reload");
  });
});
