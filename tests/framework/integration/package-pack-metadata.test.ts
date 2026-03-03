import { afterEach, describe, expect, it } from "bun:test";
import { packFrameworkTarball, readPackedPackageJson } from "../helpers/package-smoke";
import { createTempDirRegistry } from "../helpers/temp-dir";

const tempDirs = createTempDirRegistry();

afterEach(async () => {
  await tempDirs.cleanup();
});

describe("packed package metadata", () => {
  it("omits docs-app dependencies from the published framework manifest", async () => {
    const tarballPath = await packFrameworkTarball(tempDirs);
    const packedPackage = await readPackedPackageJson(tarballPath) as {
      name?: string;
      exports?: Record<string, unknown>;
      bin?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      dependencies?: Record<string, string>;
    };

    expect(packedPackage.name).toBe("react-bun-ssr");
    expect(packedPackage.exports?.["."]).toBeDefined();
    expect(packedPackage.exports?.["./route"]).toBeDefined();
    expect(packedPackage.bin?.rbssr).toBe("bin/rbssr.ts");
    expect(packedPackage.peerDependencies?.react).toBe("^19");
    expect(packedPackage.peerDependencies?.["react-dom"]).toBe("^19");
    expect(packedPackage.dependencies?.["@datadog/browser-rum"]).toBeUndefined();
    expect(packedPackage.dependencies?.["@datadog/browser-rum-react"]).toBeUndefined();
  });
});
