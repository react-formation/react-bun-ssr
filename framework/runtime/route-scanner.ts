import fs from "node:fs";
import path from "node:path";
import type {
  ApiRouteDefinition,
  PageRouteDefinition,
  RouteManifest,
  RouteSegment,
} from "./types";
import {
  isRouteGroup,
  normalizeSlashes,
  routePathFromSegments,
  toRouteId,
  trimFileExtension,
} from "./utils";

const PAGE_FILE_RE = /\.(tsx|jsx|ts|js)$/;
const API_FILE_RE = /\.(ts|js|tsx|jsx)$/;

function walkFiles(rootDir: string): string[] {
  const files: string[] = [];

  if (!fs.existsSync(rootDir)) {
    return files;
  }

  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop()!;
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
      } else if (entry.isFile()) {
        files.push(absolutePath);
      }
    }
  }

  return files;
}

function toUrlShape(relativePathWithoutExt: string): {
  routePath: string;
  segments: RouteSegment[];
} {
  const fsSegments = normalizeSlashes(relativePathWithoutExt).split("/");
  const urlSegments: string[] = [];
  const segments: RouteSegment[] = [];

  for (let index = 0; index < fsSegments.length; index += 1) {
    const segment = fsSegments[index]!;

    if (isRouteGroup(segment)) {
      continue;
    }

    const isLast = index === fsSegments.length - 1;
    if (isLast && segment === "index") {
      continue;
    }

    if (segment.startsWith("[...") && segment.endsWith("]")) {
      const value = segment.slice(4, -1);
      segments.push({ kind: "catchall", value });
      urlSegments.push(`*${value}`);
      continue;
    }

    if (segment.startsWith("[") && segment.endsWith("]")) {
      const value = segment.slice(1, -1);
      segments.push({ kind: "dynamic", value });
      urlSegments.push(`:${value}`);
      continue;
    }

    segments.push({ kind: "static", value: segment });
    urlSegments.push(segment);
  }

  return {
    routePath: routePathFromSegments(urlSegments),
    segments,
  };
}

function getRouteScore(segments: RouteSegment[]): number {
  return segments.reduce((score, segment) => {
    if (segment.kind === "static") {
      return score + 30;
    }
    if (segment.kind === "dynamic") {
      return score + 20;
    }
    return score + 1;
  }, 0);
}

function getAncestorDirs(relativeDir: string): string[] {
  const normalized = normalizeSlashes(relativeDir);
  if (!normalized || normalized === ".") {
    return [""];
  }

  const parts = normalized.split("/");
  const result = [""];
  let cursor = "";

  for (const part of parts) {
    cursor = cursor ? `${cursor}/${part}` : part;
    result.push(cursor);
  }

  return result;
}

function sortRoutes<T extends { score: number; segments: RouteSegment[]; routePath: string }>(
  routes: T[],
): T[] {
  return routes.sort((a, b) => {
    if (a.score !== b.score) {
      return b.score - a.score;
    }

    if (a.segments.length !== b.segments.length) {
      return b.segments.length - a.segments.length;
    }

    return a.routePath.localeCompare(b.routePath);
  });
}

export function scanRoutes(routesDir: string): RouteManifest {
  const allFiles = walkFiles(routesDir).sort((a, b) => a.localeCompare(b));

  const layoutByDir = new Map<string, string>();
  const middlewareByDir = new Map<string, string>();

  const pageRoutes: PageRouteDefinition[] = [];
  const apiRoutes: ApiRouteDefinition[] = [];

  for (const absoluteFilePath of allFiles) {
    const relativeFilePath = normalizeSlashes(path.relative(routesDir, absoluteFilePath));
    const relativeDir = normalizeSlashes(path.dirname(relativeFilePath) === "." ? "" : path.dirname(relativeFilePath));
    const fileName = path.basename(relativeFilePath);
    const fileBaseName = trimFileExtension(fileName);

    if (fileBaseName === "_layout" && PAGE_FILE_RE.test(fileName)) {
      layoutByDir.set(relativeDir, absoluteFilePath);
      continue;
    }

    if (fileBaseName === "_middleware" && API_FILE_RE.test(fileName)) {
      middlewareByDir.set(relativeDir, absoluteFilePath);
    }
  }

  for (const absoluteFilePath of allFiles) {
    const relativeFilePath = normalizeSlashes(path.relative(routesDir, absoluteFilePath));
    const relativeDir = normalizeSlashes(path.dirname(relativeFilePath) === "." ? "" : path.dirname(relativeFilePath));
    const fileName = path.basename(relativeFilePath);
    const fileBaseName = trimFileExtension(fileName);

    if (
      (fileBaseName === "_layout" && PAGE_FILE_RE.test(fileName)) ||
      (fileBaseName === "_middleware" && API_FILE_RE.test(fileName))
    ) {
      continue;
    }

    const isApiRoute = relativeFilePath.startsWith("api/");

    if (isApiRoute) {
      if (!API_FILE_RE.test(fileName) || fileBaseName.startsWith("_")) {
        continue;
      }

      const withoutExt = trimFileExtension(relativeFilePath);
      const shape = toUrlShape(withoutExt);
      const ancestors = getAncestorDirs(relativeDir);
      const middlewareFiles = ancestors
        .map(dir => middlewareByDir.get(dir))
        .filter((value): value is string => Boolean(value));

      apiRoutes.push({
        type: "api",
        id: toRouteId(withoutExt),
        filePath: absoluteFilePath,
        routePath: shape.routePath,
        segments: shape.segments,
        score: getRouteScore(shape.segments),
        middlewareFiles,
        directory: relativeDir,
      });
      continue;
    }

    if (!PAGE_FILE_RE.test(fileName) || fileBaseName.startsWith("_")) {
      continue;
    }

    const withoutExt = trimFileExtension(relativeFilePath);
    const shape = toUrlShape(withoutExt);
    const ancestors = getAncestorDirs(relativeDir);

    const layoutFiles = ancestors
      .map(dir => layoutByDir.get(dir))
      .filter((value): value is string => Boolean(value));

    const middlewareFiles = ancestors
      .map(dir => middlewareByDir.get(dir))
      .filter((value): value is string => Boolean(value));

    pageRoutes.push({
      type: "page",
      id: toRouteId(withoutExt),
      filePath: absoluteFilePath,
      routePath: shape.routePath,
      segments: shape.segments,
      score: getRouteScore(shape.segments),
      layoutFiles,
      middlewareFiles,
      directory: relativeDir,
    });
  }

  return {
    pages: sortRoutes(pageRoutes),
    api: sortRoutes(apiRoutes),
  };
}
