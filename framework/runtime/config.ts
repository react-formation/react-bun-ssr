import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { FrameworkConfig, ResolvedConfig } from "./types";

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

  const filePath = candidates.find(file => fs.existsSync(file));
  if (!filePath) {
    return {};
  }

  const imported = await import(pathToFileURL(filePath).href);
  return (imported.default ?? imported.config ?? {}) as FrameworkConfig;
}
