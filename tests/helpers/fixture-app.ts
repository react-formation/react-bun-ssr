import path from "node:path";
import { ensureDir, existsPath } from "../../framework/runtime/io";
import type { TempDirRegistry } from "./temp-dir";

export type FixtureContent = string | Blob | ArrayBuffer | ArrayBufferView | Uint8Array;
export type FixtureFiles = Record<string, FixtureContent>;

function linkDirectory(target: string, linkPath: string): void {
  const result = Bun.spawnSync({
    cmd: ["ln", "-s", target, linkPath],
    stdout: "pipe",
    stderr: "pipe",
  });

  if (result.exitCode !== 0) {
    const stderr = result.stderr.length > 0 ? new TextDecoder().decode(result.stderr).trim() : "";
    throw new Error(`Failed to create symlink ${linkPath} -> ${target}: ${stderr || result.exitCode}`);
  }
}

async function linkRuntimeDependencies(rootDir: string): Promise<void> {
  const repoRoot = path.resolve(import.meta.dir, "../..");
  const nodeModulesDir = path.join(rootDir, "node_modules");
  await ensureDir(nodeModulesDir);

  const links = [
    [repoRoot, path.join(nodeModulesDir, "react-bun-ssr")],
    [path.join(repoRoot, "node_modules", "react"), path.join(nodeModulesDir, "react")],
    [path.join(repoRoot, "node_modules", "react-dom"), path.join(nodeModulesDir, "react-dom")],
  ] as const;

  for (const [target, linkPath] of links) {
    if (await existsPath(linkPath)) {
      continue;
    }
    linkDirectory(target, linkPath);
  }
}

function toWritableContent(content: FixtureContent): string | Blob | ArrayBuffer | Uint8Array {
  if (ArrayBuffer.isView(content) && !(content instanceof Uint8Array)) {
    return new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
  }

  return content as string | Blob | ArrayBuffer | Uint8Array;
}

export async function writeFixtureFiles(
  rootDir: string,
  files: FixtureFiles,
): Promise<void> {
  await Promise.all(
    Object.entries(files).map(async ([relativePath, content]) => {
      const filePath = path.join(rootDir, relativePath);
      await ensureDir(path.dirname(filePath));
      await Bun.write(filePath, toWritableContent(content));
    }),
  );
}

export async function createFixtureApp(
  registry: TempDirRegistry,
  files: FixtureFiles,
  prefix = "rbssr-fixture",
): Promise<string> {
  const rootDir = await registry.create(prefix);
  await writeFixtureFiles(rootDir, files);
  await linkRuntimeDependencies(rootDir);
  return rootDir;
}
