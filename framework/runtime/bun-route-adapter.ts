import path from "node:path";
import { ensureCleanDir, ensureDir, writeTextIfChanged } from "./io";
import { scanRoutes } from "./route-scanner";
import type {
  ApiRouteDefinition,
  PageRouteDefinition,
  Params,
  RouteManifest,
  RouteMatch,
} from "./types";
import { normalizeSlashes, toImportPath } from "./utils";

const PAGE_STUB_EXT = ".tsx";
const API_STUB_EXT = ".ts";
const ROUTER_FILE_EXTENSIONS = [".tsx", ".jsx", ".ts", ".js"];

export interface BunRouteAdapter {
  manifest: RouteManifest;
  matchPage(pathname: string): RouteMatch<PageRouteDefinition> | null;
  matchApi(pathname: string): RouteMatch<ApiRouteDefinition> | null;
}

function toRouterRelativePath(routePath: string, extension: string): string {
  if (routePath === "/") {
    return `index${extension}`;
  }

  const parts = routePath
    .replace(/^\/+/, "")
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      if (segment.startsWith(":")) {
        return `[${segment.slice(1)}]`;
      }
      if (segment.startsWith("*")) {
        return `[...${segment.slice(1)}]`;
      }
      return segment;
    });

  return `${parts.join("/")}${extension}`;
}

function toPageStubSource(stubFilePath: string, routeFilePath: string): string {
  const fromDir = path.dirname(stubFilePath);
  const routeImportPath = toImportPath(fromDir, routeFilePath);
  return `export { default } from "${routeImportPath}";
export * from "${routeImportPath}";
`;
}

function toApiStubSource(stubFilePath: string, routeFilePath: string): string {
  const fromDir = path.dirname(stubFilePath);
  const routeImportPath = toImportPath(fromDir, routeFilePath);
  return `export * from "${routeImportPath}";
`;
}

function normalizeParams(value: Record<string, string>): Params {
  const params: Params = {};
  for (const [key, paramValue] of Object.entries(value)) {
    params[key] = String(paramValue);
  }
  return params;
}

function normalizeRouteKey(value: string): string {
  return normalizeSlashes(value).replace(/^\/+/, "");
}

async function writeProjectionRoutes<T extends PageRouteDefinition | ApiRouteDefinition>(options: {
  routes: T[];
  outDir: string;
  extension: string;
  toSource: (stubFilePath: string, routeFilePath: string) => string;
  routeTypeLabel: "page" | "api";
}): Promise<Map<string, T>> {
  const {
    routes,
    outDir,
    extension,
    toSource,
    routeTypeLabel,
  } = options;
  await ensureDir(outDir);

  const byProjectedFilePath = new Map<string, T>();
  const collisionMap = new Map<string, T>();

  for (const route of routes) {
    const relativeFilePath = normalizeSlashes(toRouterRelativePath(route.routePath, extension));
    const projectedFilePath = path.join(outDir, relativeFilePath);
    const projectedKey = normalizeRouteKey(relativeFilePath);
    const existing = collisionMap.get(projectedKey);

    if (existing) {
      throw new Error(
        `Route projection collision for ${routeTypeLabel} routes: "${existing.filePath}" and "${route.filePath}" both map to "${relativeFilePath}"`,
      );
    }

    collisionMap.set(projectedKey, route);

    await ensureDir(path.dirname(projectedFilePath));
    await writeTextIfChanged(projectedFilePath, toSource(projectedFilePath, route.filePath));
    byProjectedFilePath.set(projectedKey, route);
  }

  return byProjectedFilePath;
}

function toRouteMatch<T extends PageRouteDefinition | ApiRouteDefinition>(
  routeByProjectedPath: Map<string, T>,
  pathname: string,
  router: Bun.FileSystemRouter,
): RouteMatch<T> | null {
  const matched = router.match(pathname);
  if (!matched) {
    return null;
  }

  const matchedSource = normalizeRouteKey(
    ((matched as { src?: string; scriptSrc?: string }).src
      ?? (matched as { src?: string; scriptSrc?: string }).scriptSrc
      ?? ""),
  );
  const route = routeByProjectedPath.get(matchedSource);
  if (!route) {
    return null;
  }

  return {
    route,
    params: normalizeParams(matched.params),
  };
}

export async function createBunRouteAdapter(options: {
  routesDir: string;
  generatedMarkdownRootDir: string;
  projectionRootDir: string;
}): Promise<BunRouteAdapter> {
  const manifest = await scanRoutes(options.routesDir, {
    generatedMarkdownRootDir: options.generatedMarkdownRootDir,
  });

  await ensureCleanDir(options.projectionRootDir);

  const pagesProjectionDir = path.join(options.projectionRootDir, "pages");
  const apiProjectionDir = path.join(options.projectionRootDir, "api");

  const pageRouteByProjectedPath = await writeProjectionRoutes({
    routes: manifest.pages,
    outDir: pagesProjectionDir,
    extension: PAGE_STUB_EXT,
    toSource: toPageStubSource,
    routeTypeLabel: "page",
  });

  const apiRouteByProjectedPath = await writeProjectionRoutes({
    routes: manifest.api,
    outDir: apiProjectionDir,
    extension: API_STUB_EXT,
    toSource: toApiStubSource,
    routeTypeLabel: "api",
  });

  const pageRouter = new Bun.FileSystemRouter({
    style: "nextjs",
    dir: pagesProjectionDir,
    fileExtensions: ROUTER_FILE_EXTENSIONS,
  });

  const apiRouter = new Bun.FileSystemRouter({
    style: "nextjs",
    dir: apiProjectionDir,
    fileExtensions: ROUTER_FILE_EXTENSIONS,
  });

  return {
    manifest,
    matchPage(pathname) {
      return toRouteMatch(pageRouteByProjectedPath, pathname, pageRouter);
    },
    matchApi(pathname) {
      return toRouteMatch(apiRouteByProjectedPath, pathname, apiRouter);
    },
  };
}
