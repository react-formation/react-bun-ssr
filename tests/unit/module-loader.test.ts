import { describe, expect, it } from "bun:test";
import {
  createServerBuildConfig,
  createServerModuleCacheKey,
} from "../../framework/runtime/module-loader";

describe("module loader server bytecode", () => {
  it("includes bun version and serverBytecode in cache keys", () => {
    const filePath = "/tmp/example/route.ts";
    const keyWithBytecode = createServerModuleCacheKey({
      absoluteFilePath: filePath,
      serverBytecode: true,
    });
    const keyWithoutBytecode = createServerModuleCacheKey({
      absoluteFilePath: filePath,
      serverBytecode: false,
    });

    expect(keyWithBytecode).toContain(`|bun:${Bun.version}`);
    expect(keyWithoutBytecode).toContain(`|bun:${Bun.version}`);
    expect(keyWithBytecode).not.toBe(keyWithoutBytecode);
  });

  it("selects bytecode server build options when enabled", () => {
    const config = createServerBuildConfig({
      absoluteFilePath: "/tmp/example/route.ts",
      outDir: "/tmp/example/out",
      serverBytecode: true,
    });

    expect(config.target).toBe("bun");
    expect(config.format).toBe("cjs");
    expect(config.bytecode).toBe(true);
    expect(config.optimizeImports).toContain("react-bun-ssr");
    expect(config.optimizeImports).toContain("react");
  });

  it("selects non-bytecode server build options when disabled", () => {
    const config = createServerBuildConfig({
      absoluteFilePath: "/tmp/example/route.ts",
      outDir: "/tmp/example/out",
      serverBytecode: false,
    });

    expect(config.target).toBe("bun");
    expect(config.format).toBe("esm");
    expect(config.bytecode).toBe(false);
    expect(config.optimizeImports).toContain("react-bun-ssr/route");
  });
});
