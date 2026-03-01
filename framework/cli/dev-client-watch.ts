import path from "node:path";
import {
  createClientEntrySetSignature,
  listBuildOutputFiles,
  mapBuildOutputsFromMetafile,
  type ClientEntryFile,
} from "../runtime/build-tools";
import { ensureDir, readText, removePath, statPath } from "../runtime/io";
import type { BuildRouteAsset } from "../runtime/types";

export interface DevClientBuildSnapshot {
  entrySetSignature: string;
  routeAssets: Record<string, BuildRouteAsset>;
  outputFiles: string[];
  buildCount: number;
}

export interface DevClientWatchHandle {
  syncEntries(entries: ClientEntryFile[]): Promise<{ restarted: boolean; entrySetSignature: string }>;
  getBuildCount(): number;
  waitForBuildAfter(buildCount: number): Promise<void>;
  waitUntilReady(): Promise<void>;
  stop(): Promise<void>;
}

interface DevClientWatchState {
  buildCount: number;
  entrySetSignature: string;
  entries: ClientEntryFile[];
  readyPromise: Promise<void>;
  resolveReady: () => void;
  rejectReady: (error: unknown) => void;
  outputFiles: Set<string>;
  process: Bun.Subprocess<"ignore", "inherit", "inherit"> | null;
  stopped: boolean;
  waiters: Array<{
    minBuildCount: number;
    resolve: () => void;
    reject: (error: unknown) => void;
  }>;
}

function createDeferred(): {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
} {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

export function createDevClientWatch(options: {
  cwd: string;
  outDir: string;
  metafilePath: string;
  entries: ClientEntryFile[];
  publicPrefix: string;
  onBuild: (snapshot: DevClientBuildSnapshot) => void | Promise<void>;
  onLog?: (message: string) => void;
}): DevClientWatchHandle {
  const state: DevClientWatchState = {
    buildCount: 0,
    entrySetSignature: createClientEntrySetSignature(options.entries),
    entries: [...options.entries],
    ...(() => {
      const deferred = createDeferred();
      return {
        readyPromise: deferred.promise,
        resolveReady: deferred.resolve,
        rejectReady: deferred.reject,
      };
    })(),
    outputFiles: new Set<string>(),
    process: null,
    stopped: false,
    waiters: [],
  };

  let metafilePoller: ReturnType<typeof setInterval> | undefined;
  let lastMetafileMtime = "";

  const stopPolling = (): void => {
    if (metafilePoller) {
      clearInterval(metafilePoller);
      metafilePoller = undefined;
    }
  };

  const parseMetafile = async (): Promise<void> => {
    const stat = await statPath(options.metafilePath);
    if (!stat?.isFile()) {
      return;
    }

    const nextMtime = stat.mtime.toISOString();
    if (nextMtime === lastMetafileMtime) {
      return;
    }

    let metafile: Bun.BuildMetafile;
    try {
      metafile = JSON.parse(await readText(options.metafilePath)) as Bun.BuildMetafile;
    } catch {
      return;
    }

    lastMetafileMtime = nextMtime;

    const nextOutputFiles = new Set(listBuildOutputFiles(metafile));
    const staleOutputFiles = [...state.outputFiles].filter((filePath) => !nextOutputFiles.has(filePath));

    await Promise.all(
      staleOutputFiles.map((filePath) => removePath(path.resolve(options.cwd, filePath))),
    );

    state.outputFiles = nextOutputFiles;
    state.buildCount += 1;

    const readyWaiters = state.waiters.filter((waiter) => state.buildCount > waiter.minBuildCount);
    state.waiters = state.waiters.filter((waiter) => state.buildCount <= waiter.minBuildCount);
    for (const waiter of readyWaiters) {
      waiter.resolve();
    }

    await options.onBuild({
      entrySetSignature: state.entrySetSignature,
      routeAssets: mapBuildOutputsFromMetafile({
        metafile,
        entries: state.entries,
        publicPrefix: options.publicPrefix,
      }),
      outputFiles: [...nextOutputFiles].sort(),
      buildCount: state.buildCount,
    });

    state.resolveReady();
  };

  const startProcess = async (): Promise<void> => {
    await ensureDir(path.dirname(options.metafilePath));
    await ensureDir(options.outDir);
    await removePath(options.metafilePath);

    const previousOutputFiles = [...state.outputFiles];
    const deferred = createDeferred();
    state.readyPromise = deferred.promise;
    state.resolveReady = deferred.resolve;
    state.rejectReady = deferred.reject;
    state.buildCount = 0;
    state.outputFiles = new Set<string>();
    lastMetafileMtime = "";

    if (state.entries.length === 0) {
      await Promise.all(
        previousOutputFiles.map((filePath) => removePath(path.resolve(options.cwd, filePath))),
      );
      state.resolveReady();
      return;
    }

    const cmd = [
      "bun",
      "build",
      "--watch",
      "--no-clear-screen",
      "--target=browser",
      "--format=esm",
      "--splitting",
      "--sourcemap=inline",
      "--outdir",
      options.outDir,
      `--metafile=${options.metafilePath}`,
      "--entry-naming",
      "[name].[ext]",
      "--chunk-naming",
      "[name]-[hash].[ext]",
      "--asset-naming",
      "[name]-[hash].[ext]",
      ...state.entries.map((entry) => entry.entryFilePath),
    ];

    state.process = Bun.spawn({
      cmd,
      cwd: options.cwd,
      stdin: "ignore",
      stdout: "inherit",
      stderr: "inherit",
      env: process.env,
    });

    void state.process.exited.then((exitCode) => {
      if (state.stopped || exitCode === 0) {
        return;
      }
      for (const waiter of state.waiters) {
        waiter.reject(new Error(`bun build --watch exited with code ${exitCode}`));
      }
      state.waiters = [];
      state.rejectReady(new Error(`bun build --watch exited with code ${exitCode}`));
    });

    metafilePoller = setInterval(() => {
      void parseMetafile();
    }, 75);
  };

  const stopProcess = async (): Promise<void> => {
    stopPolling();

    if (!state.process) {
      return;
    }

    const active = state.process;
    state.process = null;
    active.kill();
    await active.exited;
  };

  void startProcess();

  return {
    async syncEntries(entries) {
      const nextEntrySetSignature = createClientEntrySetSignature(entries);
      const restarted = nextEntrySetSignature !== state.entrySetSignature;
      state.entries = [...entries];

      if (!restarted) {
        options.onLog?.("kept Bun client watch hot");
        return {
          restarted: false,
          entrySetSignature: state.entrySetSignature,
        };
      }

      state.entrySetSignature = nextEntrySetSignature;
      await stopProcess();
      await startProcess();
      options.onLog?.("restarted Bun client watch after entry set change");

      return {
        restarted: true,
        entrySetSignature: state.entrySetSignature,
      };
    },
    getBuildCount() {
      return state.buildCount;
    },
    waitForBuildAfter(buildCount) {
      if (state.buildCount > buildCount || state.entries.length === 0) {
        return Promise.resolve();
      }

      return new Promise<void>((resolve, reject) => {
        state.waiters.push({
          minBuildCount: buildCount,
          resolve,
          reject,
        });
      });
    },
    waitUntilReady() {
      return state.readyPromise;
    },
    async stop() {
      state.stopped = true;
      stopPolling();
      await stopProcess();
    },
  };
}
