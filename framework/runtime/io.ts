import path from "node:path";

type BunFileStat = Awaited<ReturnType<ReturnType<typeof Bun.file>["stat"]>>;
export type HashInput = string | ArrayBuffer | Uint8Array;
export interface FileEntry {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
}

function isErrno(error: unknown, code: string): boolean {
  return Boolean(
    error
      && typeof error === "object"
      && "code" in error
      && (error as { code?: unknown }).code === code,
  );
}

export async function statPath(filePath: string): Promise<BunFileStat | null> {
  try {
    return await Bun.file(filePath).stat();
  } catch (error) {
    if (isErrno(error, "ENOENT")) {
      return null;
    }
    throw error;
  }
}

export async function existsPath(filePath: string): Promise<boolean> {
  return (await statPath(filePath)) !== null;
}

export async function readText(filePath: string): Promise<string> {
  return Bun.file(filePath).text();
}

export async function writeText(filePath: string, content: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await Bun.write(filePath, content);
}

export async function writeTextIfChanged(filePath: string, content: string): Promise<boolean> {
  const stat = await statPath(filePath);
  if (stat?.isFile()) {
    const current = await readText(filePath);
    if (current === content) {
      return false;
    }
  }

  await writeText(filePath, content);
  return true;
}

export async function glob(
  pattern: string,
  options: {
    cwd: string;
    absolute?: boolean;
    dot?: boolean;
  },
): Promise<string[]> {
  const entries: string[] = [];
  const scanner = new Bun.Glob(pattern);
  for await (const entry of scanner.scan({
    ...options,
    dot: options.dot ?? true,
  })) {
    entries.push(entry);
  }
  return entries.sort((a, b) => a.localeCompare(b));
}

export function sha256Short(input: HashInput): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(input);
  return hasher.digest("hex").slice(0, 8);
}

export async function ensureDir(dirPath: string): Promise<void> {
  runPosix(["mkdir", "-p", dirPath], `Failed to create directory: ${dirPath}`);
}

export async function ensureCleanDir(dirPath: string): Promise<void> {
  await removePath(dirPath);
  await ensureDir(dirPath);
}

export async function removePath(targetPath: string): Promise<void> {
  runPosix(["rm", "-rf", targetPath], `Failed to remove path: ${targetPath}`);
}

export async function listEntries(dirPath: string): Promise<FileEntry[]> {
  const dirStat = await statPath(dirPath);
  if (!dirStat?.isDirectory()) {
    return [];
  }

  const names = await glob("*", {
    cwd: dirPath,
    dot: true,
  });

  const entries: FileEntry[] = [];
  for (const name of names) {
    const absolutePath = path.join(dirPath, name);
    const entryStat = await statPath(absolutePath);
    if (!entryStat) {
      continue;
    }

    entries.push({
      name,
      isDirectory: entryStat.isDirectory(),
      isFile: entryStat.isFile(),
    });
  }

  return entries;
}

export async function makeTempDir(prefix: string): Promise<string> {
  const dirPath = path.join("/tmp", `${prefix}-${Bun.randomUUIDv7()}`);
  await ensureDir(dirPath);
  return dirPath;
}

function runPosix(cmd: string[], context: string): void {
  const result = Bun.spawnSync({
    cmd,
    stdout: "pipe",
    stderr: "pipe",
  });

  if (result.exitCode === 0) {
    return;
  }

  const decoder = new TextDecoder();
  const stderr = result.stderr.length > 0 ? decoder.decode(result.stderr).trim() : "";
  const stdout = result.stdout.length > 0 ? decoder.decode(result.stdout).trim() : "";
  const details = stderr || stdout || `exit code ${result.exitCode}`;
  throw new Error(`[io] ${context} (${cmd.join(" ")}): ${details}`);
}
