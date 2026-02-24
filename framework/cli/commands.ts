import fs from "node:fs";
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

function writeProductionServerEntrypoint(options: { distDir: string }): void {
  const serverDir = path.join(options.distDir, "server");
  fs.mkdirSync(serverDir, { recursive: true });

  const serverEntryPath = path.join(serverDir, "server.mjs");
  const content = `import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import config from "../../rbssr.config.ts";
import { startHttpServer } from "../../framework/runtime/index.ts";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
process.chdir(rootDir);

const manifestPath = path.resolve(rootDir, "dist/manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

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

  fs.writeFileSync(serverEntryPath, content, "utf8");
}

export async function runInit(args: string[], cwd = process.cwd()): Promise<void> {
  const flags = parseFlags(args);
  scaffoldApp(cwd, {
    force: flags.force,
  });
  log("project scaffolded");
}

export async function runBuild(cwd = process.cwd()): Promise<void> {
  const { resolved } = await getConfig(cwd);

  const distClientDir = path.join(resolved.distDir, "client");
  const generatedDir = path.resolve(cwd, ".rbssr/generated/client-entries");

  ensureCleanDirectory(resolved.distDir);
  ensureCleanDirectory(generatedDir);

  const routeManifest = buildRouteManifest(resolved);
  const entries = generateClientEntries({
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

  copyDirRecursive(resolved.publicDir, distClientDir);

  const buildManifest = createBuildManifest(routeAssets);
  fs.writeFileSync(
    path.join(resolved.distDir, "manifest.json"),
    JSON.stringify(buildManifest, null, 2),
    "utf8",
  );

  writeProductionServerEntrypoint({ distDir: resolved.distDir });

  log(`build complete: ${resolved.distDir}`);
}

export async function runDev(cwd = process.cwd()): Promise<void> {
  const { userConfig, resolved } = await getConfig(cwd);
  const generatedDir = path.resolve(cwd, ".rbssr/generated/client-entries");
  const devClientDir = path.resolve(cwd, ".rbssr/dev/client");

  fs.mkdirSync(generatedDir, { recursive: true });
  fs.mkdirSync(devClientDir, { recursive: true });

  let routeAssets: Record<string, BuildRouteAsset> = {};
  let signature = "";
  let version = 0;
  const reloadListeners = new Set<(nextVersion: number) => void>();

  const notifyReload = (): void => {
    for (const listener of reloadListeners) {
      listener(version);
    }
  };

  const rebuildIfNeeded = async (force = false): Promise<void> => {
    const nextSignature = discoverFileSignature(resolved.appDir);
    if (!force && nextSignature === signature) {
      return;
    }

    signature = nextSignature;

    const manifest = buildRouteManifest(resolved);
    const entries = generateClientEntries({
      config: resolved,
      manifest,
      generatedDir,
    });

    ensureCleanDirectory(devClientDir);

    routeAssets = await bundleClientEntries({
      entries,
      outDir: devClientDir,
      dev: true,
      publicPrefix: "/__rbssr/client/",
    });

    version += 1;
    notifyReload();
    log(`rebuilt client assets (version ${version})`);
  };

  await rebuildIfNeeded(true);

  let rebuildQueue = Promise.resolve();
  let rebuildTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleRebuild = (): void => {
    if (rebuildTimer) {
      clearTimeout(rebuildTimer);
    }

    rebuildTimer = setTimeout(() => {
      rebuildTimer = undefined;
      rebuildQueue = rebuildQueue
        .then(() => rebuildIfNeeded(false))
        .catch(error => {
          // eslint-disable-next-line no-console
          console.error("[rbssr] rebuild failed", error);
        });
    }, 75);
  };

  let watcher: fs.FSWatcher | undefined;
  try {
    watcher = fs.watch(resolved.appDir, { recursive: true }, () => {
      scheduleRebuild();
    });
  } catch (error) {
    log("recursive file watching unavailable; using request-time rebuild checks");
  }

  const cleanup = (): void => {
    if (rebuildTimer) {
      clearTimeout(rebuildTimer);
      rebuildTimer = undefined;
    }
    watcher?.close();
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
      onBeforeRequest: watcher ? undefined : () => rebuildIfNeeded(false),
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
  if (!fs.existsSync(serverEntry)) {
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

  runSubprocess(["bun", "test", "tests/unit/**/*.test.ts"]);
  runSubprocess(["bun", "test", "tests/integration/**/*.test.ts"]);
  runSubprocess(["bun", "x", "playwright", "test"]);
}
