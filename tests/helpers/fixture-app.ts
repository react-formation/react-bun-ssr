import path from "node:path";
import { ensureDir } from "../../framework/runtime/io";
import type { TempDirRegistry } from "./temp-dir";

export type FixtureContent = string | Blob | ArrayBuffer | ArrayBufferView | Uint8Array;
export type FixtureFiles = Record<string, FixtureContent>;

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
  return rootDir;
}
