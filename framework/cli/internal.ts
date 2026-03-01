import path from "node:path";
import { statPath, type FileEntry } from "../runtime/io";
import type { ResolvedConfig } from "../runtime/types";

export interface CliFlags {
  force: boolean;
}

export interface SnapshotSourceTarget {
  sourcePath: string;
  snapshotPath: string;
  isDirectory: boolean;
  isFile: boolean;
}

export type CliCommand = "init" | "dev" | "build" | "start" | "typecheck" | "test";

export type CliInvocation =
  | { kind: "command"; command: CliCommand; args: string[] }
  | { kind: "help" }
  | { kind: "unknown"; command: string };

export function parseFlags(args: string[]): CliFlags {
  return {
    force: args.includes("--force"),
  };
}

export function createProductionServerEntrypointSource(): string {
  return `import path from "node:path";
import config from "../../rbssr.config.ts";
import { startHttpServer } from "react-bun-ssr";

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
}

export async function readProjectEntries(rootDir: string): Promise<FileEntry[]> {
  const entries: FileEntry[] = [];

  for await (const name of new Bun.Glob("*").scan({
    cwd: rootDir,
    dot: true,
    onlyFiles: false,
  })) {
    const entryStat = await statPath(path.join(rootDir, name));
    if (!entryStat) {
      continue;
    }

    entries.push({
      name,
      isDirectory: entryStat.isDirectory(),
      isFile: entryStat.isFile(),
    });
  }

  return entries.sort((left, right) => left.name.localeCompare(right.name));
}

function toSnapshotPath(snapshotRoot: string, cwd: string, sourcePath: string): string {
  return path.join(snapshotRoot, path.relative(cwd, sourcePath));
}

export function createDevSnapshotConfig(
  resolved: ResolvedConfig,
  snapshotRoot: string,
): ResolvedConfig {
  return {
    ...resolved,
    appDir: toSnapshotPath(snapshotRoot, resolved.cwd, resolved.appDir),
    routesDir: toSnapshotPath(snapshotRoot, resolved.cwd, resolved.routesDir),
    rootModule: toSnapshotPath(snapshotRoot, resolved.cwd, resolved.rootModule),
    middlewareFile: toSnapshotPath(snapshotRoot, resolved.cwd, resolved.middlewareFile),
  };
}

const SNAPSHOT_EXCLUDED_TOP_LEVEL = new Set([
  ".git",
  ".github",
  ".rbssr",
  "AGENTS.md",
  "bin",
  "bun-env.d.ts",
  "bun.lock",
  "bunfig.toml",
  "CONTRIBUTING.md",
  "Dockerfile",
  "dist",
  "fly.toml",
  "framework",
  "node_modules",
  "package.json",
  "playwright.config.ts",
  "README.md",
  "rbssr.config.ts",
  "tsconfig.json",
]);

export function shouldMirrorSnapshotEntry(name: string): boolean {
  if (SNAPSHOT_EXCLUDED_TOP_LEVEL.has(name)) {
    return false;
  }

  return !/^react-bun-ssr-.*\.tgz$/.test(name);
}

export function createDevSnapshotTargets(
  cwd: string,
  snapshotRoot: string,
  entries: FileEntry[],
): SnapshotSourceTarget[] {
  return entries
    .filter(entry => shouldMirrorSnapshotEntry(entry.name))
    .map(entry => ({
      sourcePath: path.join(cwd, entry.name),
      snapshotPath: path.join(snapshotRoot, entry.name),
      isDirectory: entry.isDirectory,
      isFile: entry.isFile,
    }));
}

export function shouldUseRequestTimeRebuildCheck(
  expectedWatcherCount: number,
  actualWatcherCount: number,
): boolean {
  return actualWatcherCount < expectedWatcherCount;
}

export function listStaleSnapshotVersions(entries: FileEntry[], retainCount = 3): string[] {
  return entries
    .filter(entry => entry.isDirectory && /^v\d+$/.test(entry.name))
    .map(entry => entry.name)
    .sort((a, b) => Number(b.slice(1)) - Number(a.slice(1)))
    .slice(retainCount);
}

export function createTypecheckCommand(): string[] {
  return ["bun", "x", "tsc", "--noEmit"];
}

export function createTestCommands(extraArgs: string[]): string[][] {
  if (extraArgs.length > 0) {
    return [["bun", "test", ...extraArgs]];
  }

  return [
    ["bun", "test", "./tests/unit"],
    ["bun", "test", "./tests/integration"],
    ["bun", "x", "playwright", "test"],
  ];
}

export function formatCliHelp(): string {
  return `rbssr commands:
  rbssr init [--force]
  rbssr dev
  rbssr build
  rbssr start
  rbssr typecheck
  rbssr test [bun-test-args]
`;
}

export function resolveCliInvocation(argv: string[]): CliInvocation {
  const [command = "help", ...rest] = argv;

  switch (command) {
    case "init":
    case "dev":
    case "build":
    case "start":
    case "typecheck":
    case "test":
      return {
        kind: "command",
        command,
        args: rest,
      };
    case "help":
    case "--help":
    case "-h":
      return { kind: "help" };
    default:
      return {
        kind: "unknown",
        command,
      };
  }
}
