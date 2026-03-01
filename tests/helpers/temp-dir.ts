import { makeTempDir, removePath } from "../../framework/runtime/io";

export interface TempDirRegistry {
  create(prefix: string): Promise<string>;
  track(dirPath: string): void;
  cleanup(): Promise<void>;
}

export function createTempDirRegistry(): TempDirRegistry {
  const dirs: string[] = [];

  return {
    async create(prefix: string): Promise<string> {
      const dirPath = await makeTempDir(prefix);
      dirs.push(dirPath);
      return dirPath;
    },
    track(dirPath: string): void {
      dirs.push(dirPath);
    },
    async cleanup(): Promise<void> {
      for (const dirPath of dirs.splice(0, dirs.length)) {
        await removePath(dirPath);
      }
    },
  };
}
