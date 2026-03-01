import { watch, type FSWatcher } from "node:fs";
import path from "node:path";
import { buildRouteManifest, syncClientEntries, type ClientEntryFile } from "../runtime/build-tools";
import { loadUserConfig, resolveConfig } from "../runtime/config";
import { compileMarkdownRouteModule } from "../runtime/markdown-routes";
import { ensureDir, existsPath } from "../runtime/io";
import { createServer } from "../runtime/server";
import type { BuildRouteAsset, FrameworkConfig, RouteManifest } from "../runtime/types";
import { normalizeSlashes, stableHash } from "../runtime/utils";
import { RBSSR_DEV_RESTART_EXIT_CODE } from "./internal";
import { createDevClientWatch, type DevClientWatchHandle } from "./dev-client-watch";
import {
  createDevRouteTable,
  RBSSR_DEV_RELOAD_TOPIC,
  type DevReloadMessage,
  type DevReloadReason,
} from "./dev-route-table";

function log(message: string): void {
  // eslint-disable-next-line no-console
  console.log(`[rbssr] ${message}`);
}

function isConfigFileName(fileName: string): boolean {
  return fileName === "rbssr.config.ts" || fileName === "rbssr.config.js" || fileName === "rbssr.config.mjs";
}

function isTopLevelAppRuntimeFile(relativePath: string): boolean {
  return /^root\.(tsx|jsx|ts|js)$/.test(relativePath) || /^middleware\.(tsx|jsx|ts|js)$/.test(relativePath);
}

function isMarkdownRouteFile(relativePath: string): boolean {
  return /^routes\/.+\.md$/.test(relativePath);
}

function isStructuralAppPath(relativePath: string): boolean {
  return relativePath === "routes"
    || relativePath.startsWith("routes/")
    || isTopLevelAppRuntimeFile(relativePath);
}

function toAbsoluteAppPath(appDir: string, relativePath: string): string {
  return path.join(appDir, relativePath);
}

interface DevHotData {
  bunServer?: Bun.Server<undefined>;
  reloadToken?: number;
  routeManifestVersion?: number;
}

export async function runHotDevChild(options: {
  cwd: string;
}): Promise<void> {
  const userConfig = await loadUserConfig(options.cwd);
  const resolved = resolveConfig({
    ...userConfig,
    mode: "development",
  }, options.cwd);

  const generatedClientEntriesDir = path.resolve(options.cwd, ".rbssr/generated/client-entries");
  const generatedMarkdownRootDir = path.resolve(options.cwd, ".rbssr/generated/markdown-routes");
  const devClientDir = path.resolve(options.cwd, ".rbssr/dev/client");
  const clientMetafilePath = path.resolve(options.cwd, ".rbssr/dev/client-metafile.json");

  await Promise.all([
    ensureDir(generatedClientEntriesDir),
    ensureDir(generatedMarkdownRootDir),
    ensureDir(devClientDir),
  ]);

  const hotData = (import.meta.hot?.data ?? {}) as DevHotData;
  let bunServer = hotData.bunServer;
  let reloadToken = hotData.reloadToken ?? 0;
  let routeManifestVersion = hotData.routeManifestVersion ?? 0;
  let manifest: RouteManifest = {
    pages: [],
    api: [],
  };
  let routeAssets: Record<string, BuildRouteAsset> = {};
  let clientWatch: DevClientWatchHandle | null = null;
  let frameworkServer = createFrameworkServer(userConfig, {
    routeAssets,
    reloadToken: () => reloadToken,
    routeManifestVersion: () => routeManifestVersion,
  });
  let suppressNextClientReload = true;
  let nextClientBuildReason: DevReloadReason | null = null;
  let stopping = false;

  const watchers: FSWatcher[] = [];
  let structuralSyncTimer: ReturnType<typeof setTimeout> | undefined;
  let structuralSyncQueue: Promise<void> = Promise.resolve();

  const publishReload = (reason: DevReloadReason): void => {
    reloadToken += 1;
    if (bunServer) {
      const message: DevReloadMessage = {
        token: reloadToken,
        reason,
      };
      bunServer.publish(RBSSR_DEV_RELOAD_TOPIC, JSON.stringify(message));
    }
  };

  const onClientBuild = async (nextRouteAssets: Record<string, BuildRouteAsset>): Promise<void> => {
    routeAssets = nextRouteAssets;
    frameworkServer = createFrameworkServer(userConfig, {
      routeAssets,
      reloadToken: () => reloadToken,
      routeManifestVersion: () => routeManifestVersion,
    });

    if (suppressNextClientReload) {
      suppressNextClientReload = false;
      nextClientBuildReason = null;
      return;
    }

    publishReload(nextClientBuildReason ?? "client-build");
    nextClientBuildReason = null;
  };

  const buildServeOptions = (): Bun.Serve.Options<undefined, string> => {
    return {
      id: `rbssr-dev:${stableHash(normalizeSlashes(resolved.cwd))}`,
      hostname: resolved.host,
      port: resolved.port,
      development: true,
      routes: createDevRouteTable({
        devClientDir,
        manifest,
        handleFrameworkFetch: frameworkServer.fetch,
      }),
      fetch: frameworkServer.fetch,
      websocket: {
        open(ws) {
          ws.subscribe(RBSSR_DEV_RELOAD_TOPIC);
          const message: DevReloadMessage = {
            token: reloadToken,
            reason: "server-runtime",
          };
          ws.send(JSON.stringify(message));
        },
        message() {
          // noop
        },
      },
    };
  };

  const ensureClientWatch = async (entries: ClientEntryFile[]): Promise<void> => {
    if (clientWatch) {
      return;
    }

    clientWatch = createDevClientWatch({
      cwd: options.cwd,
      outDir: devClientDir,
      metafilePath: clientMetafilePath,
      entries,
      publicPrefix: "/__rbssr/client/",
      onBuild: async (snapshot) => {
        await onClientBuild(snapshot.routeAssets);
      },
      onLog: (message) => {
        log(message);
      },
    });
  };

  const performStructuralSync = async (mode: "bootstrap" | "update"): Promise<void> => {
    const nextManifest = await buildRouteManifest(resolved);
    const syncResult = await syncClientEntries({
      config: resolved,
      manifest: nextManifest,
      generatedDir: generatedClientEntriesDir,
    });

    const previousBuildCount = clientWatch?.getBuildCount() ?? 0;
    suppressNextClientReload = true;
    nextClientBuildReason = null;

    await ensureClientWatch(syncResult.entries);

    if (!clientWatch) {
      throw new Error("client watch failed to initialize");
    }

    const watchSync = await clientWatch.syncEntries(syncResult.entries);
    const shouldAwaitBuild = watchSync.restarted
      || syncResult.addedEntryPaths.length > 0
      || syncResult.changedEntryPaths.length > 0
      || syncResult.removedEntryPaths.length > 0;

    if (watchSync.restarted) {
      await clientWatch.waitUntilReady();
    } else if (shouldAwaitBuild) {
      await clientWatch.waitForBuildAfter(previousBuildCount);
    } else {
      await clientWatch.waitUntilReady();
      suppressNextClientReload = false;
    }

    manifest = nextManifest;
    routeManifestVersion += 1;
    frameworkServer = createFrameworkServer(userConfig, {
      routeAssets,
      reloadToken: () => reloadToken,
      routeManifestVersion: () => routeManifestVersion,
    });

    const nextServeOptions = buildServeOptions();
    if (bunServer) {
      bunServer.reload(nextServeOptions);
    } else {
      bunServer = Bun.serve(nextServeOptions);
      log(`dev server listening on ${bunServer.url}`);
    }

    if (mode === "update") {
      publishReload("route-structure");
    }
  };

  const enqueueStructuralSync = (mode: "bootstrap" | "update"): Promise<void> => {
    const task = structuralSyncQueue.then(() => performStructuralSync(mode));
    structuralSyncQueue = task.catch((error) => {
      // eslint-disable-next-line no-console
      console.error("[rbssr] structural sync failed", error);
    });
    return task;
  };

  const scheduleStructuralSync = (): void => {
    if (structuralSyncTimer) {
      clearTimeout(structuralSyncTimer);
    }

    structuralSyncTimer = setTimeout(() => {
      structuralSyncTimer = undefined;
      void enqueueStructuralSync("update");
    }, 75);
  };

  const restartForConfigChange = async (): Promise<void> => {
    if (stopping) {
      return;
    }
    stopping = true;
    publishReload("config-restart");
    await cleanup({ preserveServer: false });
    process.exit(RBSSR_DEV_RESTART_EXIT_CODE);
  };

  const handleAppEvent = (eventType: string, fileName?: string | Buffer | null): void => {
    const relativePath = typeof fileName === "string"
      ? normalizeSlashes(fileName)
      : "";

    if (!relativePath) {
      scheduleStructuralSync();
      return;
    }

    if (eventType === "rename" && isStructuralAppPath(relativePath)) {
      scheduleStructuralSync();
      return;
    }

    if (eventType !== "change" || !isMarkdownRouteFile(relativePath)) {
      return;
    }

    const sourceFilePath = toAbsoluteAppPath(resolved.appDir, relativePath);
    void (async () => {
      if (!(await existsPath(sourceFilePath))) {
        return;
      }
      await compileMarkdownRouteModule({
        routesDir: resolved.routesDir,
        sourceFilePath,
        generatedMarkdownRootDir,
      });
      nextClientBuildReason = "markdown-route";
    })().catch((error) => {
      // eslint-disable-next-line no-console
      console.error("[rbssr] markdown rebuild failed", error);
    });
  };

  const addWatcher = (watcher: FSWatcher | null): void => {
    if (watcher) {
      watchers.push(watcher);
    }
  };

  const cleanup = async (options: {
    preserveServer: boolean;
  }): Promise<void> => {
    if (structuralSyncTimer) {
      clearTimeout(structuralSyncTimer);
      structuralSyncTimer = undefined;
    }

    for (const watcher of watchers.splice(0, watchers.length)) {
      watcher.close();
    }

    if (clientWatch) {
      await clientWatch.stop();
      clientWatch = null;
    }

    if (!options.preserveServer && bunServer) {
      await bunServer.stop(true);
      bunServer = undefined;
    }
  };

  try {
    addWatcher(
      watch(resolved.appDir, { recursive: true }, (eventType, fileName) => {
        handleAppEvent(eventType, fileName);
      }),
    );
  } catch {
    log(`recursive file watching unavailable for ${resolved.appDir}; dev route topology updates may require a restart`);
  }

  try {
    addWatcher(
      watch(options.cwd, (eventType, fileName) => {
        if (typeof fileName !== "string" || !isConfigFileName(fileName)) {
          return;
        }
        if (eventType === "rename" || eventType === "change") {
          void restartForConfigChange();
        }
      }),
    );
  } catch {
    log(`config file watching unavailable for ${options.cwd}; config changes may require a manual restart`);
  }

  if (import.meta.hot) {
    import.meta.hot.dispose(async (data: DevHotData) => {
      data.bunServer = bunServer;
      data.reloadToken = reloadToken;
      data.routeManifestVersion = routeManifestVersion;
      await cleanup({ preserveServer: true });
    });
  }

  await enqueueStructuralSync("bootstrap");

  if (hotData.bunServer && bunServer) {
    publishReload("server-runtime");
  }
}

function createFrameworkServer(
  userConfig: FrameworkConfig,
  options: {
    routeAssets: Record<string, BuildRouteAsset>;
    reloadToken: () => number;
    routeManifestVersion: () => number;
  },
): ReturnType<typeof createServer> {
  return createServer(
    {
      ...userConfig,
      mode: "development",
    },
    {
      dev: true,
      getDevAssets: () => options.routeAssets,
      reloadVersion: options.reloadToken,
      routeManifestVersion: options.routeManifestVersion,
    },
  );
}
