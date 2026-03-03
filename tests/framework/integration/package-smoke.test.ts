import path from "node:path";
import { afterEach, describe, expect, it, setDefaultTimeout } from "bun:test";
import { readText, writeText } from "../../../framework/runtime/io";
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

setDefaultTimeout(120_000);

afterEach(async () => {
  await tempDirs.cleanup();
});

describeConsumer("package smoke", () => {
  it("packs, installs, initializes, builds, and starts a consumer app", async () => {
    const tarballPath = await packFrameworkTarball(tempDirs);
    const bootstrapDir = await prepareConsumerApp(tempDirs, tarballPath);
    const consumerDir = await tempDirs.create("rbssr-consumer-app");
    const port = 33_000 + Math.floor(Math.random() * 1_000);

    let result = await runProcess({
      cmd: ["bun", "install"],
      cwd: bootstrapDir,
    });
    expect(result.exitCode).toBe(0);

    await assertConsumerCliBin(bootstrapDir);
    const cliBin = resolveConsumerCliBin(bootstrapDir);

    result = await runProcess({
      cmd: [cliBin, "init"],
      cwd: consumerDir,
    });
    expect(result.exitCode).toBe(0);

    const generatedPackage = JSON.parse(await readText(path.join(consumerDir, "package.json"))) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
    };
    const packedPackage = await Bun.file(Bun.resolveSync("react-bun-ssr/package.json", bootstrapDir)).json() as {
      version?: string;
    };

    expect(generatedPackage.scripts).toEqual({
      dev: "rbssr dev",
      build: "rbssr build",
      start: "rbssr start",
      typecheck: "bunx tsc --noEmit",
    });
    expect(generatedPackage.dependencies?.["react-bun-ssr"]).toBe(packedPackage.version);
    expect(generatedPackage.dependencies?.react).toBe("^19");
    expect(generatedPackage.dependencies?.["react-dom"]).toBe("^19");

    generatedPackage.dependencies = {
      ...generatedPackage.dependencies,
      "react-bun-ssr": `file:${tarballPath}`,
    };
    await writeText(
      path.join(consumerDir, "package.json"),
      `${JSON.stringify(generatedPackage, null, 2)}\n`,
    );

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
      cmd: ["bun", "run", "build"],
      cwd: consumerDir,
    });
    expect(result.exitCode).toBe(0);

    const serverEntry = await readText(path.join(consumerDir, "dist/server/server.mjs"));
    expect(serverEntry).toContain('from "react-bun-ssr"');

    const serverProcess = spawnProcess({
      cmd: ["bun", "run", "start"],
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
