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

function toNormalizedWatchPath(fileName?: string | Buffer | null): string {
  return typeof fileName === "string" ? normalizeSlashes(fileName) : "";
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

  let structuralSyncTimer: ReturnType<typeof setTimeout> | undefined;
  let structuralSyncQueue: Promise<void> = Promise.resolve();
  let routesWatcher: FSWatcher | null = null;
  let appWatcher: FSWatcher | null = null;
  let configWatcher: FSWatcher | null = null;

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

  const handleAppEvent = (eventType: string, relativePath: string): void => {
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

  const ensureRoutesWatcher = async (): Promise<void> => {
    if (routesWatcher || !(await existsPath(resolved.routesDir))) {
      return;
    }

    try {
      routesWatcher = watch(resolved.routesDir, { recursive: true }, (eventType, fileName) => {
        const nestedPath = toNormalizedWatchPath(fileName);
        const relativePath = nestedPath ? `routes/${nestedPath}` : "routes";
        handleAppEvent(eventType, relativePath);
      });
    } catch {
      log(`recursive route watching unavailable for ${resolved.routesDir}; route topology updates may require a restart`);
    }
  };

  const refreshRoutesWatcher = async (): Promise<void> => {
    if (routesWatcher) {
      routesWatcher.close();
      routesWatcher = null;
    }

    await ensureRoutesWatcher();
  };

  const cleanup = async (options: {
    preserveServer: boolean;
  }): Promise<void> => {
    if (structuralSyncTimer) {
      clearTimeout(structuralSyncTimer);
      structuralSyncTimer = undefined;
    }

    routesWatcher?.close();
    routesWatcher = null;
    appWatcher?.close();
    appWatcher = null;
    configWatcher?.close();
    configWatcher = null;

    if (clientWatch) {
      await clientWatch.stop();
      clientWatch = null;
    }

    if (!options.preserveServer && bunServer) {
      await bunServer.stop(true);
      bunServer = undefined;
    }
  };

  await refreshRoutesWatcher();

  try {
    appWatcher = watch(resolved.appDir, (eventType, fileName) => {
      const relativePath = toNormalizedWatchPath(fileName);
      if (relativePath === "routes" && eventType === "rename") {
        void refreshRoutesWatcher();
      }

      handleAppEvent(eventType, relativePath);
    });
  } catch {
    log(`top-level app watching unavailable for ${resolved.appDir}; route topology updates may require a restart`);
  }

  try {
    configWatcher = watch(options.cwd, (eventType, fileName) => {
      const configFileName = toNormalizedWatchPath(fileName);
      if (!configFileName || !isConfigFileName(configFileName)) {
        return;
      }
      if (eventType === "rename" || eventType === "change") {
        void restartForConfigChange();
      }
    });
  } catch {
    log(`config file watching unavailable for ${options.cwd}; config changes may require a manual restart`);
  }

  await enqueueStructuralSync("bootstrap");
  await refreshRoutesWatcher();

  if (import.meta.hot) {
    import.meta.hot.dispose(async (data: DevHotData) => {
      data.bunServer = bunServer;
      data.reloadToken = reloadToken;
      data.routeManifestVersion = routeManifestVersion;
      await cleanup({ preserveServer: true });
    });
  }

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
