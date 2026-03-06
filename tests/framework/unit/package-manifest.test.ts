import { describe, expect, it } from "bun:test";

describe("package dependency ownership", () => {
  it("keeps the published framework manifest free of docs-app runtime dependencies", async () => {
    const rootPackage = await Bun.file("package.json").json() as {
      workspaces?: string[];
      dependencies?: Record<string, string>;
    };

    expect(rootPackage.workspaces).toContain("app");
    expect(rootPackage.dependencies?.["@datadog/browser-rum"]).toBeUndefined();
    expect(rootPackage.dependencies?.["@datadog/browser-rum-react"]).toBeUndefined();
  });

  it("assigns docs-app runtime dependencies to app/package.json", async () => {
    const appPackage = await Bun.file("app/package.json").json() as {
      private?: boolean;
      dependencies?: Record<string, string>;
    };

    expect(appPackage.private).toBe(true);
    expect(appPackage.dependencies?.["react-bun-ssr"]).toBe("link:react-bun-ssr");
    expect(appPackage.dependencies?.["react"]).toBe("^19");
    expect(appPackage.dependencies?.["react-dom"]).toBe("^19");
    expect(Object.keys(appPackage.dependencies ?? {}).sort()).toEqual([
      "react",
      "react-bun-ssr",
      "react-dom",
    ]);
  });
});
