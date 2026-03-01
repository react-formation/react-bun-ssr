import path from "node:path";
import { afterEach, describe, expect, it, setDefaultTimeout } from "bun:test";
import { existsPath } from "../../framework/runtime/io";
import { createFixtureApp } from "../helpers/fixture-app";
import { spawnProcess, waitForHttpReady } from "../helpers/process";
import { createTempDirRegistry } from "../helpers/temp-dir";

const tempDirs = createTempDirRegistry();
const rbssrBinPath = path.resolve(import.meta.dir, "../../bin/rbssr.ts");

let activeProcess: Bun.Subprocess | null = null;

setDefaultTimeout(20_000);

afterEach(async () => {
  if (activeProcess) {
    activeProcess.kill();
    await activeProcess.exited;
    activeProcess = null;
  }

  await tempDirs.cleanup();
});

describe("CLI dev runtime", () => {
  it("starts without creating versioned server snapshots", async () => {
    const root = await createFixtureApp(tempDirs, {
      "rbssr.config.ts": `export default { appDir: "app", port: 3217 };`,
      "app/root.tsx": `export default function Root(){ return <main>root</main>; }`,
      "app/routes/index.tsx": `export default function Index(){ return <h1>home</h1>; }`,
    }, "rbssr-cli-dev-hot");

    activeProcess = spawnProcess({
      cmd: ["bun", rbssrBinPath, "dev"],
      cwd: root,
      stdout: "ignore",
      stderr: "pipe",
    });

    await waitForHttpReady("http://127.0.0.1:3217");

    expect(await existsPath(path.join(root, ".rbssr/generated/dev/entry.ts"))).toBe(true);
    expect(await existsPath(path.join(root, ".rbssr/dev/server-snapshots"))).toBe(false);
  });
});
