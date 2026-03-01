import path from "node:path";
import { ensureDir, existsPath, writeText } from "../../framework/runtime/io";
import type { TempDirRegistry } from "./temp-dir";
import { runProcess } from "./process";

const REPO_ROOT = path.resolve(import.meta.dir, "../..");

export async function packFrameworkTarball(
  registry: TempDirRegistry,
): Promise<string> {
  const outputDir = await registry.create("rbssr-pack");
  const result = await runProcess({
    cmd: ["npm", "pack", "--pack-destination", outputDir],
    cwd: REPO_ROOT,
  });

  if (result.exitCode !== 0) {
    throw new Error(`npm pack failed:\n${result.stderr || result.stdout}`);
  }

  const tarballName = result.stdout
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .find(line => line.endsWith(".tgz"));
  if (!tarballName) {
    throw new Error(`npm pack did not output a tarball name.\n${result.stdout}`);
  }

  return path.join(outputDir, tarballName);
}

export async function createConsumerPackageJson(options: {
  consumerDir: string;
  tarballPath: string;
}): Promise<void> {
  const packageJson = {
    name: "rbssr-consumer-smoke",
    version: "0.0.0",
    private: true,
    dependencies: {
      react: "^19.2.0",
      "react-dom": "^19.2.0",
      "react-bun-ssr": `file:${options.tarballPath}`,
    },
  };

  await writeText(
    path.join(options.consumerDir, "package.json"),
    `${JSON.stringify(packageJson, null, 2)}\n`,
  );
}

export function resolveConsumerCliBin(consumerDir: string): string {
  return path.join(consumerDir, "node_modules", ".bin", "rbssr");
}

export async function assertConsumerCliBin(consumerDir: string): Promise<void> {
  const cliBin = resolveConsumerCliBin(consumerDir);
  if (!(await existsPath(cliBin))) {
    throw new Error(`Missing consumer CLI binary at ${cliBin}`);
  }
}

export async function prepareConsumerApp(
  registry: TempDirRegistry,
  tarballPath: string,
): Promise<string> {
  const consumerDir = await registry.create("rbssr-consumer");
  await ensureDir(consumerDir);
  await createConsumerPackageJson({
    consumerDir,
    tarballPath,
  });
  return consumerDir;
}
