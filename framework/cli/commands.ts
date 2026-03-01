import { watch, type FSWatcher } from "node:fs";
import path from "node:path";
import {
  buildRouteManifest,
  bundleClientEntries,
  copyDirRecursive,
  createBuildManifest,
  discoverFileSignature,
  ensureCleanDirectory,
  generateClientEntries,
} from "../runtime/build-tools";
import { loadUserConfig, resolveConfig } from "../runtime/config";
import { ensureDir, existsPath, removePath, statPath, writeText } from "../runtime/io";
import { createServer } from "../runtime/server";
import type { BuildRouteAsset, FrameworkConfig, ResolvedConfig } from "../runtime/types";
import {
  createDevSnapshotTargets,
  createDevSnapshotConfig,
  createProductionServerEntrypointSource,
  createTestCommands,
  createTypecheckCommand,
  listStaleSnapshotVersions,
  parseFlags,
  readProjectEntries,
  shouldUseRequestTimeRebuildCheck,
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

async function copySnapshotTarget(options: {
  sourcePath: string;
  snapshotPath: string;
  isDirectory: boolean;
  isFile: boolean;
}): Promise<void> {
  if (options.isDirectory) {
    await copyDirRecursive(options.sourcePath, options.snapshotPath);
    return;
  }

  if (!options.isFile) {
    return;
  }

  await ensureDir(path.dirname(options.snapshotPath));
  await Bun.write(options.snapshotPath, Bun.file(options.sourcePath));
}

async function mirrorSnapshotSources(cwd: string, snapshotRoot: string): Promise<string[]> {
  const targets = createDevSnapshotTargets(cwd, snapshotRoot, await readProjectEntries(cwd));
  await Promise.all(targets.map(copySnapshotTarget));
  return targets.map(target => target.sourcePath);
}

async function watchSourceRoot(
  sourcePath: string,
  onChange: () => void,
): Promise<FSWatcher | null> {
  const sourceStat = await statPath(sourcePath);
  if (!sourceStat) {
    return null;
  }

  try {
    return sourceStat.isDirectory()
      ? watch(sourcePath, { recursive: true }, onChange)
      : watch(sourcePath, onChange);
  } catch {
    return null;
  }
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
  const { userConfig, resolved } = await getConfig(cwd);
  const generatedDir = path.resolve(cwd, ".rbssr/generated/client-entries");
  const devClientDir = path.resolve(cwd, ".rbssr/dev/client");
  const serverSnapshotsRoot = path.resolve(cwd, ".rbssr/dev/server-snapshots");

  await Promise.all([
    ensureDir(generatedDir),
    ensureDir(devClientDir),
    ensureCleanDirectory(serverSnapshotsRoot),
  ]);

  let routeAssets: Record<string, BuildRouteAsset> = {};
  let signature = "";
  let version = 0;
  let currentRuntimePaths: Partial<ResolvedConfig> = {};
  let sourceDirty = true;
  const reloadListeners = new Set<(nextVersion: number) => void>();
  const watchedRoots = createDevSnapshotTargets(cwd, serverSnapshotsRoot, await readProjectEntries(cwd))
    .map(target => target.sourcePath);

  const getSourceSignature = async (): Promise<string> => {
    const signatures = await Promise.all(
      watchedRoots.map(root => discoverFileSignature(root)),
    );
    return signatures.join(":");
  };

  const notifyReload = (): void => {
    for (const listener of reloadListeners) {
      listener(version);
    }
  };

  const rebuildIfNeeded = async (force = false): Promise<void> => {
    if (!force && !sourceDirty) {
      return;
    }

    const nextSignature = await getSourceSignature();
    if (!force && nextSignature === signature) {
      sourceDirty = false;
      return;
    }

    sourceDirty = false;
    signature = nextSignature;

    const snapshotDir = path.join(serverSnapshotsRoot, `v${version + 1}`);
    await ensureCleanDirectory(snapshotDir);
    await mirrorSnapshotSources(cwd, snapshotDir);

    const snapshotConfig = createDevSnapshotConfig(resolved, snapshotDir);

    const manifest = await buildRouteManifest(snapshotConfig);
    const entries = await generateClientEntries({
      config: snapshotConfig,
      manifest,
      generatedDir,
    });

    await ensureCleanDirectory(devClientDir);

    routeAssets = await bundleClientEntries({
      entries,
      outDir: devClientDir,
      dev: true,
      publicPrefix: "/__rbssr/client/",
    });

    currentRuntimePaths = {
      appDir: snapshotConfig.appDir,
      routesDir: snapshotConfig.routesDir,
      rootModule: snapshotConfig.rootModule,
      middlewareFile: snapshotConfig.middlewareFile,
    };

    const staleVersions = listStaleSnapshotVersions(await readProjectEntries(serverSnapshotsRoot));
    await Promise.all(staleVersions.map(stale => removePath(path.join(serverSnapshotsRoot, stale))));

    version += 1;
    notifyReload();
    log(`rebuilt client assets (version ${version})`);
  };

  let rebuildQueue: Promise<void> = Promise.resolve();
  const enqueueRebuild = (force = false): Promise<void> => {
    const task = rebuildQueue.then(() => rebuildIfNeeded(force));
    rebuildQueue = task.catch(error => {
      // eslint-disable-next-line no-console
      console.error("[rbssr] rebuild failed", error);
    });
    return task;
  };

  await enqueueRebuild(true);

  let rebuildTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleRebuild = (): void => {
    if (rebuildTimer) {
      clearTimeout(rebuildTimer);
    }

    rebuildTimer = setTimeout(() => {
      rebuildTimer = undefined;
      void enqueueRebuild(false);
    }, 75);
  };

  const watchers: FSWatcher[] = [];
  for (const root of watchedRoots) {
    const watcher = await watchSourceRoot(root, () => {
      sourceDirty = true;
      scheduleRebuild();
    });
    if (watcher) {
      watchers.push(watcher);
    } else {
      log(`recursive file watching unavailable for ${root}; relying on request-time rebuild checks`);
    }
  }

  const useRequestTimeRebuildCheck = shouldUseRequestTimeRebuildCheck(watchedRoots.length, watchers.length);

  const cleanup = (): void => {
    if (rebuildTimer) {
      clearTimeout(rebuildTimer);
      rebuildTimer = undefined;
    }
    for (const watcher of watchers) {
      watcher.close();
    }
  };

  process.once("SIGINT", () => {
    cleanup();
    process.exit(0);
  });

  process.once("SIGTERM", () => {
    cleanup();
    process.exit(0);
  });

  const server = createServer(
    {
      ...userConfig,
      mode: "development",
    },
    {
      dev: true,
      getDevAssets: () => routeAssets,
      reloadVersion: () => version,
      subscribeReload: listener => {
        reloadListeners.add(listener);
        return () => {
          reloadListeners.delete(listener);
        };
      },
      resolvePaths: () => currentRuntimePaths,
      onBeforeRequest: () => {
        if (!sourceDirty && !useRequestTimeRebuildCheck) {
          return Promise.resolve();
        }

        if (useRequestTimeRebuildCheck) {
          sourceDirty = true;
        }

        return enqueueRebuild(false);
      },
    },
  );

  const bunServer = Bun.serve({
    hostname: resolved.host,
    port: resolved.port,
    fetch: server.fetch,
    development: true,
  });

  log(`dev server listening on ${bunServer.url}`);
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
