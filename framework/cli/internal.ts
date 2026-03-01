import path from "node:path";
import { statPath, type FileEntry } from "../runtime/io";

export interface CliFlags {
  force: boolean;
}

export type CliCommand = "init" | "dev" | "build" | "start" | "typecheck" | "test";

export type CliInvocation =
  | { kind: "command"; command: CliCommand; args: string[] }
  | { kind: "help" }
  | { kind: "unknown"; command: string };

export const RBSSR_DEV_RESTART_EXIT_CODE = 75;

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

export function createDevHotEntrypointSource(options: {
  cwd: string;
  runtimeModulePath: string;
}): string {
  const cwd = JSON.stringify(path.resolve(options.cwd));
  const runtimeModulePath = JSON.stringify(path.resolve(options.runtimeModulePath));

  return `import { runHotDevChild } from ${runtimeModulePath};

process.chdir(${cwd});
await runHotDevChild({
  cwd: ${cwd},
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
