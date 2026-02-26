import path from "node:path";
import { existsPath } from "./io";
import type { FrameworkConfig, ResolvedConfig, ResolvedResponseHeaderRule } from "./types";
import { normalizeSlashes, toFileImportUrl } from "./utils";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function globToRegExp(source: string): RegExp {
  if (source.endsWith("/**")) {
    const prefix = source.slice(0, -3);
    return new RegExp(`^${escapeRegex(prefix)}(?:/.*)?$`);
  }

  let pattern = "^";

  for (let index = 0; index < source.length; index += 1) {
    const current = source[index]!;
    const next = source[index + 1];

    if (current === "*" && next === "*") {
      pattern += ".*";
      index += 1;
      continue;
    }

    if (current === "*") {
      pattern += "[^/]*";
      continue;
    }

    pattern += escapeRegex(current);
  }

  pattern += "$";
  return new RegExp(pattern);
}

function toHeaderRules(config: FrameworkConfig): ResolvedResponseHeaderRule[] {
  if (config.headers === undefined) {
    return [];
  }

  if (!Array.isArray(config.headers)) {
    throw new Error("[rbssr config] `headers` must be an array.");
  }

  return config.headers.map((rule, index) => {
    if (!rule || typeof rule !== "object") {
      throw new Error(`[rbssr config] \`headers[${index}]\` must be an object.`);
    }

    const rawSource = rule.source;
    if (typeof rawSource !== "string" || rawSource.trim().length === 0) {
      throw new Error(`[rbssr config] \`headers[${index}].source\` must be a non-empty string.`);
    }

    const source = normalizeSlashes(rawSource.trim());
    if (!source.startsWith("/")) {
      throw new Error(`[rbssr config] \`headers[${index}].source\` must start with '/'.`);
    }

    const rawHeaders = rule.headers;
    if (!rawHeaders || typeof rawHeaders !== "object" || Array.isArray(rawHeaders)) {
      throw new Error(`[rbssr config] \`headers[${index}].headers\` must be an object.`);
    }

    const entries = Object.entries(rawHeaders);
    if (entries.length === 0) {
      throw new Error(`[rbssr config] \`headers[${index}].headers\` must include at least one header.`);
    }

    const headers: Record<string, string> = {};
    for (const [key, value] of entries) {
      if (typeof key !== "string" || key.trim().length === 0) {
        throw new Error(`[rbssr config] \`headers[${index}].headers\` contains an empty header name.`);
      }

      if (typeof value !== "string" || value.trim().length === 0) {
        throw new Error(
          `[rbssr config] \`headers[${index}].headers.${key}\` must be a non-empty string value.`,
        );
      }

      headers[key] = value;
    }

    return {
      source,
      headers,
      matcher: globToRegExp(source),
    };
  });
}

export function resolveConfig(config: FrameworkConfig = {}, cwd = process.cwd()): ResolvedConfig {
  const appDir = path.resolve(cwd, config.appDir ?? "app");
  const routesDir = path.resolve(appDir, config.routesDir ?? "routes");
  const publicDir = path.resolve(appDir, config.publicDir ?? "public");
  const rootModule = path.resolve(appDir, config.rootModule ?? "root.tsx");
  const middlewareFile = path.resolve(appDir, config.middlewareFile ?? "middleware.ts");
  const distDir = path.resolve(cwd, config.distDir ?? "dist");
  const mode = config.mode ?? (process.env.NODE_ENV === "production" ? "production" : "development");
  const serverBytecode = config.serverBytecode ?? mode === "production";
  const headerRules = toHeaderRules(config);

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
    mode,
    serverBytecode,
    headerRules,
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
