import path from "node:path";
import {
  buildRouteManifest,
  bundleClientEntries,
  copyDirRecursive,
  createBuildManifest,
  ensureCleanDirectory,
  generateClientEntries,
} from "../runtime/build-tools";
import { loadUserConfig, resolveConfig } from "../runtime/config";
import { ensureDir, existsPath, writeText, writeTextIfChanged } from "../runtime/io";
import type { FrameworkConfig, ResolvedConfig } from "../runtime/types";
import {
  createDevHotEntrypointSource,
  createProductionServerEntrypointSource,
  createTestCommands,
  createTypecheckCommand,
  parseFlags,
  RBSSR_DEV_RESTART_EXIT_CODE,
} from "./internal";
import { scaffoldApp } from "./scaffold";

function log(message: string): void {
  // eslint-disable-next-line no-console
  console.log(`[rbssr] ${message}`);
}

async function getConfig(cwd: string): Promise<{ userConfig: FrameworkConfig; resolved: ResolvedConfig }> {
  const userConfig = await loadUserConfig(cwd);
  const resolved = resolveConfig(userConfig, cwd);
  return { userConfig, resolved };
}

async function writeProductionServerEntrypoint(options: { distDir: string }): Promise<void> {
  const serverDir = path.join(options.distDir, "server");
  await ensureDir(serverDir);

  const serverEntryPath = path.join(serverDir, "server.mjs");
  await writeText(serverEntryPath, createProductionServerEntrypointSource());
}

export async function runInit(args: string[], cwd = process.cwd()): Promise<void> {
  const flags = parseFlags(args);
  await scaffoldApp(cwd, {
    force: flags.force,
  });
  log("project scaffolded");
}

export async function runBuild(cwd = process.cwd()): Promise<void> {
  const { resolved } = await getConfig(cwd);

  const distClientDir = path.join(resolved.distDir, "client");
  const generatedDir = path.resolve(cwd, ".rbssr/generated/client-entries");

  await Promise.all([
    ensureCleanDirectory(resolved.distDir),
    ensureCleanDirectory(generatedDir),
  ]);

  const routeManifest = await buildRouteManifest(resolved);
  const entries = await generateClientEntries({
    config: resolved,
    manifest: routeManifest,
    generatedDir,
  });

  const routeAssets = await bundleClientEntries({
    entries,
    outDir: distClientDir,
    dev: false,
    publicPrefix: "/client/",
  });

  await copyDirRecursive(resolved.publicDir, distClientDir);

  const buildManifest = createBuildManifest(routeAssets);
  await writeText(
    path.join(resolved.distDir, "manifest.json"),
    JSON.stringify(buildManifest, null, 2),
  );

  await writeProductionServerEntrypoint({ distDir: resolved.distDir });

  log(`build complete: ${resolved.distDir}`);
}

export async function runDev(cwd = process.cwd()): Promise<void> {
  await getConfig(cwd);

  const generatedDevDir = path.resolve(cwd, ".rbssr/generated/dev");
  const generatedEntryPath = path.join(generatedDevDir, "entry.ts");
  await ensureDir(generatedDevDir);
  await writeTextIfChanged(generatedEntryPath, createDevHotEntrypointSource({
    cwd,
    runtimeModulePath: path.resolve(import.meta.dir, "dev-runtime.ts"),
  }));

  let activeChild: Bun.Subprocess<"inherit", "inherit", "inherit"> | null = null;
  let shuttingDown = false;

  const forwardSignal = (signal: NodeJS.Signals): void => {
    shuttingDown = true;
    activeChild?.kill(signal);
  };

  process.once("SIGINT", () => {
    forwardSignal("SIGINT");
  });

  process.once("SIGTERM", () => {
    forwardSignal("SIGTERM");
  });

  while (true) {
    activeChild = Bun.spawn({
      cmd: ["bun", "--hot", generatedEntryPath],
      cwd,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
      env: {
        ...process.env,
        RBSSR_DEV_LAUNCHER: "1",
        RBSSR_DEV_CHILD: "1",
      },
    });

    const exitCode = await activeChild.exited;
    activeChild = null;

    if (shuttingDown) {
      return;
    }

    if (exitCode === RBSSR_DEV_RESTART_EXIT_CODE) {
      log("restarting dev child after config change");
      continue;
    }

    if (exitCode !== 0) {
      process.exit(exitCode);
    }

    return;
  }
}

export async function runStart(cwd = process.cwd()): Promise<void> {
  const { resolved } = await getConfig(cwd);
  const serverEntry = path.join(resolved.distDir, "server", "server.mjs");
  if (!(await existsPath(serverEntry))) {
    throw new Error("Missing dist/server/server.mjs. Run `rbssr build` first.");
  }

  runSubprocess(["bun", serverEntry]);
}

function runSubprocess(cmd: string[]): void {
  const subprocess = Bun.spawnSync({
    cmd,
    stdout: "inherit",
    stderr: "inherit",
  });

  if (subprocess.exitCode !== 0) {
    process.exit(subprocess.exitCode);
  }
}

export async function runTypecheck(): Promise<void> {
  runSubprocess(createTypecheckCommand());
}

export async function runTest(extraArgs: string[]): Promise<void> {
  for (const cmd of createTestCommands(extraArgs)) {
    runSubprocess(cmd);
  }
}
