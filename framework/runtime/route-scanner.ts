import path from "node:path";
import { compileMarkdownRouteModule } from "./markdown-routes";
import { existsPath, glob } from "./io";
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
import { sortRoutesBySpecificity } from "./route-order";

const PAGE_FILE_RE = /\.(tsx|jsx|ts|js|md|mdx)$/;
const LAYOUT_FILE_RE = /\.(tsx|jsx|ts|js)$/;
const API_FILE_RE = /\.(ts|js|tsx|jsx)$/;
const MD_FILE_RE = /\.md$/;
const MDX_FILE_RE = /\.mdx$/;
const SERVER_SUFFIX_RE = /\.server$/;

async function walkFiles(rootDir: string): Promise<string[]> {
  if (!(await existsPath(rootDir))) {
    return [];
  }

  return glob("**/*", { cwd: rootDir, absolute: true });
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

function stripServerSuffix(value: string): string {
  return value.replace(SERVER_SUFFIX_RE, "");
}

function hasServerSuffix(value: string): boolean {
  return SERVER_SUFFIX_RE.test(value);
}

function removeServerSuffixFromRelativePath(relativeFilePath: string): string {
  const extension = path.extname(relativeFilePath);
  if (!extension) {
    return relativeFilePath;
  }
  const withoutExt = relativeFilePath.slice(0, -extension.length);
  return `${stripServerSuffix(withoutExt)}${extension}`;
}

export async function scanRoutes(
  routesDir: string,
  options: {
    generatedMarkdownRootDir?: string;
  } = {},
): Promise<RouteManifest> {
  const allFiles = (await walkFiles(routesDir)).sort((a, b) => a.localeCompare(b));

  const layoutByDir = new Map<string, string>();
  const layoutServerByDir = new Map<string, string>();
  const middlewareByDir = new Map<string, string>();
  const pageCompanionByKey = new Map<string, string>();

  const pageRouteTasks: Array<Promise<PageRouteDefinition>> = [];
  const pageRouteKeys = new Set<string>();
  const apiRouteByKey = new Map<string, ApiRouteDefinition>();

  for (const absoluteFilePath of allFiles) {
    const relativeFilePath = normalizeSlashes(path.relative(routesDir, absoluteFilePath));
    const relativeDir = normalizeSlashes(path.dirname(relativeFilePath) === "." ? "" : path.dirname(relativeFilePath));
    const fileName = path.basename(relativeFilePath);
    const fileBaseName = trimFileExtension(fileName);
    const logicalBaseName = stripServerSuffix(fileBaseName);
    const isServerVariant = hasServerSuffix(fileBaseName);

    if (MDX_FILE_RE.test(fileName)) {
      throw new Error(
        `Unsupported route file "${relativeFilePath}": .mdx route files are not supported yet; use .md or TSX route module.`,
      );
    }

    if (logicalBaseName === "_layout" && LAYOUT_FILE_RE.test(fileName)) {
      if (isServerVariant) {
        if (layoutServerByDir.has(relativeDir)) {
          throw new Error(
            `Duplicate layout companion route files in "${relativeDir || "/"}": ` +
              `"${layoutServerByDir.get(relativeDir)!}" and "${absoluteFilePath}".`,
          );
        }
        layoutServerByDir.set(relativeDir, absoluteFilePath);
      } else {
        layoutByDir.set(relativeDir, absoluteFilePath);
      }
      continue;
    }

    if (logicalBaseName === "_middleware" && API_FILE_RE.test(fileName)) {
      const existing = middlewareByDir.get(relativeDir);
      if (existing && existing !== absoluteFilePath) {
        throw new Error(
          `Middleware file collision in "${relativeDir || "/"}": ` +
            `"${existing}" and "${absoluteFilePath}" both resolve to "_middleware".`,
        );
      }
      middlewareByDir.set(relativeDir, absoluteFilePath);
      continue;
    }

    if (
      isServerVariant
      && !relativeFilePath.startsWith("api/")
      && PAGE_FILE_RE.test(fileName)
      && !logicalBaseName.startsWith("_")
    ) {
      const canonicalRelativeFilePath = removeServerSuffixFromRelativePath(relativeFilePath);
      const routeKey = trimFileExtension(canonicalRelativeFilePath);
      const existing = pageCompanionByKey.get(routeKey);
      if (existing && existing !== absoluteFilePath) {
        throw new Error(
          `Duplicate route companion files for "${routeKey}": "${existing}" and "${absoluteFilePath}".`,
        );
      }
      pageCompanionByKey.set(routeKey, absoluteFilePath);
    }
  }

  for (const [relativeDir, layoutServerFilePath] of layoutServerByDir.entries()) {
    if (!layoutByDir.has(relativeDir)) {
      throw new Error(
        `Found layout companion "${layoutServerFilePath}" without base layout file "${relativeDir ? `${relativeDir}/` : ""}_layout.tsx".`,
      );
    }
  }

  for (const absoluteFilePath of allFiles) {
    const relativeFilePath = normalizeSlashes(path.relative(routesDir, absoluteFilePath));
    const relativeDir = normalizeSlashes(path.dirname(relativeFilePath) === "." ? "" : path.dirname(relativeFilePath));
    const fileName = path.basename(relativeFilePath);
    const fileBaseName = trimFileExtension(fileName);
    const logicalBaseName = stripServerSuffix(fileBaseName);
    const isServerVariant = hasServerSuffix(fileBaseName);

    if (
      (logicalBaseName === "_layout" && LAYOUT_FILE_RE.test(fileName))
      || (logicalBaseName === "_middleware" && API_FILE_RE.test(fileName))
    ) {
      continue;
    }

    const isApiRoute = relativeFilePath.startsWith("api/");

    if (isApiRoute) {
      if (!API_FILE_RE.test(fileName) || logicalBaseName.startsWith("_")) {
        continue;
      }

      const canonicalRelativeFilePath = isServerVariant
        ? removeServerSuffixFromRelativePath(relativeFilePath)
        : relativeFilePath;
      const withoutExt = trimFileExtension(canonicalRelativeFilePath);
      if (apiRouteByKey.has(withoutExt)) {
        const existing = apiRouteByKey.get(withoutExt)!;
        throw new Error(
          `API route collision for "${withoutExt}": "${existing.filePath}" and "${absoluteFilePath}". ` +
            "Use only one of the plain route file or .server route file.",
        );
      }
      const shape = toUrlShape(withoutExt);
      const canonicalRelativeDir = normalizeSlashes(
        path.dirname(canonicalRelativeFilePath) === "." ? "" : path.dirname(canonicalRelativeFilePath),
      );
      const ancestors = getAncestorDirs(canonicalRelativeDir);
      const middlewareFiles = ancestors
        .map(dir => middlewareByDir.get(dir))
        .filter((value): value is string => Boolean(value));

      apiRouteByKey.set(withoutExt, {
        type: "api",
        id: toRouteId(withoutExt),
        filePath: absoluteFilePath,
        routePath: shape.routePath,
        segments: shape.segments,
        score: getRouteScore(shape.segments),
        middlewareFiles,
        directory: canonicalRelativeDir,
      });
      continue;
    }

    if (!PAGE_FILE_RE.test(fileName) || logicalBaseName.startsWith("_") || isServerVariant) {
      continue;
    }

    const withoutExt = trimFileExtension(relativeFilePath);
    const shape = toUrlShape(withoutExt);
    const ancestors = getAncestorDirs(relativeDir);
    const routeFilePath = MD_FILE_RE.test(fileName)
      ? compileMarkdownRouteModule({
          routesDir,
          sourceFilePath: absoluteFilePath,
          generatedMarkdownRootDir: options.generatedMarkdownRootDir,
        })
      : Promise.resolve(absoluteFilePath);

    const layoutFiles = ancestors
      .map(dir => layoutByDir.get(dir))
      .filter((value): value is string => Boolean(value));

    const middlewareFiles = ancestors
      .map(dir => middlewareByDir.get(dir))
      .filter((value): value is string => Boolean(value));

    pageRouteKeys.add(withoutExt);
    pageRouteTasks.push(routeFilePath.then((resolvedRouteFilePath) => {
      return {
        type: "page",
        id: toRouteId(withoutExt),
        filePath: resolvedRouteFilePath,
        serverFilePath: pageCompanionByKey.get(withoutExt),
        routePath: shape.routePath,
        segments: shape.segments,
        score: getRouteScore(shape.segments),
        layoutFiles,
        middlewareFiles,
        directory: relativeDir,
      };
    }));
  }

  for (const [routeKey, companionPath] of pageCompanionByKey.entries()) {
    if (!pageRouteKeys.has(routeKey)) {
      throw new Error(
        `Found route companion "${companionPath}" without base route module "${routeKey}.tsx".`,
      );
    }
  }

  const pageRoutes = await Promise.all(pageRouteTasks);
  const apiRoutes = [...apiRouteByKey.values()];

  return {
    pages: sortRoutesBySpecificity(pageRoutes),
    api: sortRoutesBySpecificity(apiRoutes),
  };
}
