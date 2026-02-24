import fs from "node:fs";
import path from "node:path";
import { scanRoutes } from "./route-scanner";
import type {
  BuildManifest,
  BuildRouteAsset,
  PageRouteDefinition,
  ResolvedConfig,
  RouteManifest,
} from "./types";
import { normalizeSlashes, stableHash, toImportPath } from "./utils";

interface ClientEntryFile {
  routeId: string;
  entryFilePath: string;
  route: PageRouteDefinition;
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

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
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function writeFileIfChanged(filePath: string, content: string): void {
  if (fs.existsSync(filePath)) {
    const current = fs.readFileSync(filePath, "utf8");
    if (current === content) {
      return;
    }
  }
  fs.writeFileSync(filePath, content, "utf8");
}

function buildClientEntrySource(options: {
  generatedDir: string;
  route: PageRouteDefinition;
  rootModulePath: string;
  runtimeClientFile: string;
}): string {
  const { generatedDir, route, rootModulePath, runtimeClientFile } = options;

  const imports: string[] = [];

  const runtimeImport = toImportPath(generatedDir, runtimeClientFile);
  const rootImport = toImportPath(generatedDir, rootModulePath);
  const routeImport = toImportPath(generatedDir, route.filePath);

  imports.push(`import { hydrateRoute } from "${runtimeImport}";`);

  imports.push(`import RootDefault from "${rootImport}";`);
  imports.push(`import * as RootModule from "${rootImport}";`);

  imports.push(`import RouteDefault from "${routeImport}";`);
  imports.push(`import * as RouteModule from "${routeImport}";`);

  const layoutModuleRefs: string[] = [];
  for (let index = 0; index < route.layoutFiles.length; index += 1) {
    const layoutFilePath = route.layoutFiles[index]!;
    const layoutImportPath = toImportPath(generatedDir, layoutFilePath);
    imports.push(`import Layout${index}Default from "${layoutImportPath}";`);
    imports.push(`import * as Layout${index}Module from "${layoutImportPath}";`);
    layoutModuleRefs.push(`{ ...Layout${index}Module, default: Layout${index}Default }`);
  }

  return `${imports.join("\n")}

const modules = {
  root: { ...RootModule, default: RootDefault },
  layouts: [${layoutModuleRefs.join(", ")}],
  route: { ...RouteModule, default: RouteDefault },
};

hydrateRoute(modules);
`;
}

export function generateClientEntries(options: {
  config: ResolvedConfig;
  manifest: RouteManifest;
  generatedDir: string;
}): ClientEntryFile[] {
  const { config, manifest, generatedDir } = options;
  ensureDir(generatedDir);

  const runtimeClientFile = path.resolve(config.cwd, "framework/runtime/client-runtime.tsx");

  const entries: ClientEntryFile[] = [];

  for (const route of manifest.pages) {
    const entryName = `route__${route.id}.tsx`;
    const entryFilePath = path.join(generatedDir, entryName);
    const source = buildClientEntrySource({
      generatedDir,
      route,
      rootModulePath: config.rootModule,
      runtimeClientFile,
    });

    writeFileIfChanged(entryFilePath, source);

    entries.push({
      routeId: route.id,
      entryFilePath,
      route,
    });
  }

  return entries;
}

function mapBuildOutputsByPrefix(options: {
  outDir: string;
  routeIds: string[];
  publicPrefix: string;
}): Record<string, BuildRouteAsset> {
  const { outDir, routeIds, publicPrefix } = options;
  const files = walkFiles(outDir).map(filePath => normalizeSlashes(path.relative(outDir, filePath)));

  const routeAssets: Record<string, BuildRouteAsset> = {};

  for (const routeId of routeIds) {
    const base = `route__${routeId}`;
    const script = files.find(file => file.startsWith(base) && file.endsWith(".js"));
    const css = files.filter(file => file.startsWith(base) && file.endsWith(".css"));

    if (!script) {
      continue;
    }

    routeAssets[routeId] = {
      script: `${publicPrefix}${script}`,
      css: css.map(file => `${publicPrefix}${file}`),
    };
  }

  return routeAssets;
}

export async function bundleClientEntries(options: {
  entries: ClientEntryFile[];
  outDir: string;
  dev: boolean;
  publicPrefix: string;
}): Promise<Record<string, BuildRouteAsset>> {
  const { entries, outDir, dev, publicPrefix } = options;

  ensureDir(outDir);
  if (entries.length === 0) {
    return {};
  }

  const result = await Bun.build({
    entrypoints: entries.map(entry => entry.entryFilePath),
    outdir: outDir,
    target: "browser",
    format: "esm",
    splitting: false,
    sourcemap: dev ? "inline" : "external",
    minify: !dev,
    naming: dev ? "[name].[ext]" : "[name]-[hash].[ext]",
  });

  if (!result.success) {
    const messages = result.logs.map(log => log.message).join("\n");
    throw new Error(`Client bundle failed:\n${messages}`);
  }

  return mapBuildOutputsByPrefix({
    outDir,
    routeIds: entries.map(entry => entry.routeId),
    publicPrefix,
  });
}

export function ensureCleanDirectory(dirPath: string): void {
  fs.rmSync(dirPath, { recursive: true, force: true });
  fs.mkdirSync(dirPath, { recursive: true });
}

export function copyDirRecursive(sourceDir: string, destinationDir: string): void {
  if (!fs.existsSync(sourceDir)) {
    return;
  }

  fs.mkdirSync(destinationDir, { recursive: true });

  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(sourceDir, entry.name);
    const to = path.join(destinationDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(from, to);
    } else if (entry.isFile()) {
      fs.copyFileSync(from, to);
    }
  }
}

export function createBuildManifest(routeAssets: Record<string, BuildRouteAsset>): BuildManifest {
  return {
    version: stableHash(JSON.stringify(routeAssets)),
    generatedAt: new Date().toISOString(),
    routes: routeAssets,
  };
}

export function discoverFileSignature(rootDir: string): string {
  const files = walkFiles(rootDir)
    .filter(file => !normalizeSlashes(file).includes("/node_modules/"))
    .sort();

  const signatureBits = files.map(filePath => {
    const stat = fs.statSync(filePath);
    return `${normalizeSlashes(filePath)}:${stat.mtimeMs}:${stat.size}`;
  });

  return stableHash(signatureBits.join("|"));
}

export function buildRouteManifest(config: ResolvedConfig): RouteManifest {
  return scanRoutes(config.routesDir);
}
