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
import { ensureDir, existsPath, listEntries, removePath, writeText } from "../runtime/io";
import { createServer } from "../runtime/server";
import type { BuildRouteAsset, FrameworkConfig, ResolvedConfig } from "../runtime/types";
import { scaffoldApp } from "./scaffold";

function log(message: string): void {
  // eslint-disable-next-line no-console
  console.log(`[rbssr] ${message}`);
}

function parseFlags(args: string[]): { force: boolean } {
  return {
    force: args.includes("--force"),
  };
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
  const content = `import path from "node:path";
import config from "../../rbssr.config.ts";
import { startHttpServer } from "../../framework/runtime/index.ts";

const rootDir = path.resolve(path.dirname(Bun.fileURLToPath(import.meta.url)), "../..");
process.chdir(rootDir);

const manifestPath = path.resolve(rootDir, "dist/manifest.json");
const manifest = await Bun.file(manifestPath).json();

startHttpServer({
  config: {
    ...(config ?? {}),
    mode: "production",
  },
  runtimeOptions: {
    dev: false,
    buildManifest: manifest,
  },
});
`;

  await writeText(serverEntryPath, content);
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

  await ensureCleanDirectory(resolved.distDir);
  await ensureCleanDirectory(generatedDir);

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
  const docsSourceDir = path.resolve(cwd, "docs");
  const docsSnapshotDir = path.join(serverSnapshotsRoot, "docs");

  await ensureDir(generatedDir);
  await ensureDir(devClientDir);
  await ensureCleanDirectory(serverSnapshotsRoot);

  let routeAssets: Record<string, BuildRouteAsset> = {};
  let signature = "";
  let version = 0;
  let currentServerSnapshotDir = resolved.appDir;
  const reloadListeners = new Set<(nextVersion: number) => void>();
  const docsDir = path.resolve(cwd, "docs");

  const watchedRoots = [resolved.appDir];
  if (await existsPath(docsDir)) {
    watchedRoots.push(docsDir);
  }

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
    const nextSignature = await getSourceSignature();
    if (!force && nextSignature === signature) {
      return;
    }

    signature = nextSignature;

    const manifest = await buildRouteManifest(resolved);
    const entries = await generateClientEntries({
      config: resolved,
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

    const snapshotDir = path.join(serverSnapshotsRoot, `v${version + 1}`);
    await ensureCleanDirectory(snapshotDir);
    await copyDirRecursive(resolved.appDir, snapshotDir);
    if (await existsPath(docsSourceDir)) {
      await ensureCleanDirectory(docsSnapshotDir);
      await copyDirRecursive(docsSourceDir, docsSnapshotDir);
    } else {
      await removePath(docsSnapshotDir);
    }
    currentServerSnapshotDir = snapshotDir;

    const staleVersions = (await listEntries(serverSnapshotsRoot))
      .filter(entry => entry.isDirectory && /^v\d+$/.test(entry.name))
      .map(entry => entry.name)
      .sort((a, b) => {
        const aNum = Number(a.slice(1));
        const bNum = Number(b.slice(1));
        return bNum - aNum;
      })
      .slice(3);
    for (const stale of staleVersions) {
      await removePath(path.join(serverSnapshotsRoot, stale));
    }

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
    try {
      const watcher = watch(root, { recursive: true }, () => {
        scheduleRebuild();
      });
      watchers.push(watcher);
    } catch {
      log(`recursive file watching unavailable for ${root}; relying on request-time rebuild checks`);
    }
  }

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
      resolvePaths: () => ({
        appDir: currentServerSnapshotDir,
        routesDir: path.join(currentServerSnapshotDir, "routes"),
        rootModule: path.join(currentServerSnapshotDir, "root.tsx"),
        middlewareFile: path.join(currentServerSnapshotDir, "middleware.ts"),
      }),
      onBeforeRequest: () => {
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
  runSubprocess(["bun", "x", "tsc", "--noEmit"]);
}

export async function runTest(extraArgs: string[]): Promise<void> {
  if (extraArgs.length > 0) {
    runSubprocess(["bun", "test", ...extraArgs]);
    return;
  }

  runSubprocess(["bun", "test", "./tests/unit"]);
  runSubprocess(["bun", "test", "./tests/integration"]);
  runSubprocess(["bun", "x", "playwright", "test"]);
}
