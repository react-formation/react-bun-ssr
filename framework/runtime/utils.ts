import path from "node:path";
import { createHash } from "node:crypto";

export function normalizeSlashes(value: string): string {
  return value.replace(/\\+/g, "/");
}

export function trimFileExtension(value: string): string {
  return value.replace(/\.(tsx?|jsx?)$/, "");
}

export function ensureLeadingSlash(value: string): string {
  return value.startsWith("/") ? value : `/${value}`;
}

export function withoutTrailingSlash(value: string): string {
  if (value === "/") {
    return value;
  }
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function toRouteId(relativeFilePath: string): string {
  return normalizeSlashes(trimFileExtension(relativeFilePath))
    .replace(/\//g, "__")
    .replace(/\[\.\.\./g, "catchall_")
    .replace(/\[/g, "param_")
    .replace(/\]/g, "")
    .replace(/\(|\)/g, "")
    .replace(/[^a-zA-Z0-9_]/g, "_");
}

export function isRouteGroup(segment: string): boolean {
  return segment.startsWith("(") && segment.endsWith(")");
}

export function toImportPath(fromDir: string, absoluteTargetPath: string): string {
  const relativePath = normalizeSlashes(path.relative(fromDir, absoluteTargetPath));
  if (relativePath.startsWith(".")) {
    return relativePath;
  }
  return `./${relativePath}`;
}

export function routePathFromSegments(segments: string[]): string {
  const pathValue = segments.length === 0 ? "/" : `/${segments.join("/")}`;
  return withoutTrailingSlash(pathValue === "" ? "/" : pathValue);
}

export function parseCookieHeader(headerValue: string | null): Map<string, string> {
  const cookies = new Map<string, string>();
  if (!headerValue) {
    return cookies;
  }

  for (const part of headerValue.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (!rawName) {
      continue;
    }
    const rawValue = rest.join("=");
    try {
      cookies.set(rawName, decodeURIComponent(rawValue));
    } catch {
      cookies.set(rawName, rawValue);
    }
  }

  return cookies;
}

export function isMutatingMethod(method: string): boolean {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}

export function safeJsonSerialize(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function sanitizeErrorMessage(error: unknown, production: boolean): string {
  if (!production) {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
  return "Internal Server Error";
}

export function stableHash(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 8);
}

export function ensureWithin(baseDir: string, target: string): string | null {
  const resolved = path.resolve(baseDir, target);
  const relative = path.relative(baseDir, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }
  return resolved;
}

export function toPosixPath(value: string): string {
  return normalizeSlashes(value);
}
