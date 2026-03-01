import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import { readText, writeText } from "../../framework/runtime/io";
import {
  assertConsumerCliBin,
  packFrameworkTarball,
  prepareConsumerApp,
  resolveConsumerCliBin,
} from "../helpers/package-smoke";
import { runProcess, spawnProcess, waitForHttpReady } from "../helpers/process";
import { createTempDirRegistry } from "../helpers/temp-dir";

const tempDirs = createTempDirRegistry();
const describeConsumer = process.env.RBSSR_RUN_CONSUMER_SMOKE ? describe : describe.skip;

afterEach(async () => {
  await tempDirs.cleanup();
});

describeConsumer("package smoke", () => {
  it("packs, installs, initializes, builds, and starts a consumer app", async () => {
    const tarballPath = await packFrameworkTarball(tempDirs);
    const consumerDir = await prepareConsumerApp(tempDirs, tarballPath);
    const port = 33_000 + Math.floor(Math.random() * 1_000);

    let result = await runProcess({
      cmd: ["bun", "install"],
      cwd: consumerDir,
    });
    expect(result.exitCode).toBe(0);

    await assertConsumerCliBin(consumerDir);
    const cliBin = resolveConsumerCliBin(consumerDir);

    result = await runProcess({
      cmd: [cliBin, "init"],
      cwd: consumerDir,
    });
    expect(result.exitCode).toBe(0);

    await writeText(
      path.join(consumerDir, "rbssr.config.ts"),
      `import { defineConfig } from "react-bun-ssr";\n\nexport default defineConfig({ appDir: "app", port: ${port} });\n`,
    );

    result = await runProcess({
      cmd: ["bun", "install"],
      cwd: consumerDir,
    });
    expect(result.exitCode).toBe(0);

    result = await runProcess({
      cmd: [cliBin, "build"],
      cwd: consumerDir,
    });
    expect(result.exitCode).toBe(0);

    const serverEntry = await readText(path.join(consumerDir, "dist/server/server.mjs"));
    expect(serverEntry).toContain('from "react-bun-ssr"');

    const serverProcess = spawnProcess({
      cmd: ["bun", path.join(consumerDir, "dist/server/server.mjs")],
      cwd: consumerDir,
      stdout: "pipe",
      stderr: "pipe",
    });

    try {
      await waitForHttpReady(`http://127.0.0.1:${port}/`);

      const pageResponse = await fetch(`http://127.0.0.1:${port}/`);
      expect(pageResponse.status).toBe(200);
      expect(await pageResponse.text()).toContain("Hello from SSR");

      const healthResponse = await fetch(`http://127.0.0.1:${port}/api/health`);
      expect(healthResponse.status).toBe(200);
      expect(await healthResponse.json()).toEqual({ status: "ok" });
    } finally {
      serverProcess.kill();
      await serverProcess.exited;
    }
  });
});
