import path from "node:path";
import { afterEach, describe, expect, it, setDefaultTimeout } from "bun:test";
import { existsPath } from "../../../framework/runtime/io";
import { createFixtureApp } from "../helpers/fixture-app";
import { spawnProcess, waitForHttpReady } from "../helpers/process";
import { createTempDirRegistry } from "../helpers/temp-dir";

const tempDirs = createTempDirRegistry();
const rbssrBinPath = path.resolve(import.meta.dir, "../../../bin/rbssr.ts");

let activeProcess: Bun.Subprocess | null = null;

setDefaultTimeout(40_000);

afterEach(async () => {
  if (activeProcess) {
    activeProcess.kill();
    await activeProcess.exited;
    activeProcess = null;
  }

  await tempDirs.cleanup();
});

describe("CLI dev runtime", () => {
  it("starts without creating versioned server snapshots and can restart from existing generated entries", async () => {
    const port = 36_000 + Math.floor(Math.random() * 1_000);
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
});
