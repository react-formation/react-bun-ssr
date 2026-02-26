import path from "node:path";
import { afterAll, describe, expect, it } from "bun:test";
import {
  ensureDir,
  existsPath,
  makeTempDir,
  removePath,
  sha256Short,
  writeTextIfChanged,
} from "../../framework/runtime/io";

const tempDirs: string[] = [];

afterAll(async () => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    await removePath(dir);
  }
});

describe("runtime io", () => {
  it("computes stable short sha256 hashes", () => {
    expect(sha256Short("abc")).toBe("ba7816bf");
    expect(sha256Short(new TextEncoder().encode("abc"))).toBe("ba7816bf");
  });

  it("writes file only when content changes", async () => {
    const root = await makeTempDir("rbssr-io");
    tempDirs.push(root);

    const filePath = path.join(root, "example.txt");

    const wroteFirst = await writeTextIfChanged(filePath, "hello");
    const wroteSecond = await writeTextIfChanged(filePath, "hello");
    const wroteThird = await writeTextIfChanged(filePath, "world");
    const finalContent = await Bun.file(filePath).text();

    expect(wroteFirst).toBe(true);
    expect(wroteSecond).toBe(false);
    expect(wroteThird).toBe(true);
    expect(finalContent).toBe("world");
  });

  it("handles directory paths with spaces", async () => {
    const root = await makeTempDir("rbssr-io-spaces");
    tempDirs.push(root);

    const nestedDir = path.join(root, "dir with spaces", "inner");
    await ensureDir(nestedDir);
    expect(await existsPath(nestedDir)).toBe(true);

    await removePath(path.join(root, "dir with spaces"));
    expect(await existsPath(nestedDir)).toBe(false);
  });

  it("creates unique temp directories with UUIDv7 suffixes", async () => {
    const first = await makeTempDir("rbssr-io-v7");
    const second = await makeTempDir("rbssr-io-v7");
    tempDirs.push(first, second);

    expect(first).not.toBe(second);

    const firstSuffix = path.basename(first).slice("rbssr-io-v7-".length);
    const secondSuffix = path.basename(second).slice("rbssr-io-v7-".length);
    const uuidV7Re = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    expect(firstSuffix).toMatch(uuidV7Re);
    expect(secondSuffix).toMatch(uuidV7Re);
  });

  it("fails fast when posix command errors", async () => {
    let message = "";
    try {
      await ensureDir("/dev/null");
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain("Failed to create directory");
  });
});
