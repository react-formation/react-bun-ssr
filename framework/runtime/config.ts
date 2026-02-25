import path from "node:path";
import { existsPath } from "./io";
import type { FrameworkConfig, ResolvedConfig } from "./types";
import { toFileImportUrl } from "./utils";

export function resolveConfig(config: FrameworkConfig = {}, cwd = process.cwd()): ResolvedConfig {
  const appDir = path.resolve(cwd, config.appDir ?? "app");
  const routesDir = path.resolve(appDir, config.routesDir ?? "routes");
  const publicDir = path.resolve(appDir, config.publicDir ?? "public");
  const rootModule = path.resolve(appDir, config.rootModule ?? "root.tsx");
  const middlewareFile = path.resolve(appDir, config.middlewareFile ?? "middleware.ts");
  const distDir = path.resolve(cwd, config.distDir ?? "dist");

  return {
    cwd,
    appDir,
    routesDir,
    publicDir,
    rootModule,
    middlewareFile,
    distDir,
    host: config.host ?? "0.0.0.0",
    port: config.port ?? 3000,
    mode: config.mode ?? (process.env.NODE_ENV === "production" ? "production" : "development"),
  };
}

export async function loadUserConfig(cwd = process.cwd()): Promise<FrameworkConfig> {
  const candidates = [
    path.resolve(cwd, "rbssr.config.ts"),
    path.resolve(cwd, "rbssr.config.js"),
    path.resolve(cwd, "rbssr.config.mjs"),
  ];

  let filePath: string | undefined;
  for (const candidate of candidates) {
    if (await existsPath(candidate)) {
      filePath = candidate;
      break;
    }
  }

  if (!filePath) {
    return {};
  }

  const imported = await import(toFileImportUrl(filePath));
  return (imported.default ?? imported.config ?? {}) as FrameworkConfig;
}
