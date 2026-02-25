import path from "node:path";
import { scanRoutes } from "./route-scanner";
import {
  ensureCleanDir,
  ensureDir,
  existsPath,
  glob,
  statPath,
  writeTextIfChanged,
} from "./io";
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

async function walkFiles(rootDir: string): Promise<string[]> {
  if (!(await existsPath(rootDir))) {
    return [];
  }

  return glob("**/*", { cwd: rootDir, absolute: true });
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

export async function generateClientEntries(options: {
  config: ResolvedConfig;
  manifest: RouteManifest;
  generatedDir: string;
}): Promise<ClientEntryFile[]> {
  const { config, manifest, generatedDir } = options;
  await ensureDir(generatedDir);

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

    await writeTextIfChanged(entryFilePath, source);

    entries.push({
      routeId: route.id,
      entryFilePath,
      route,
    });
  }

  return entries;
}

async function mapBuildOutputsByPrefix(options: {
  outDir: string;
  routeIds: string[];
  publicPrefix: string;
}): Promise<Record<string, BuildRouteAsset>> {
  const { outDir, routeIds, publicPrefix } = options;
  const files = (await walkFiles(outDir)).map(filePath => normalizeSlashes(path.relative(outDir, filePath)));

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

  await ensureDir(outDir);
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

export async function ensureCleanDirectory(dirPath: string): Promise<void> {
  await ensureCleanDir(dirPath);
}

export async function copyDirRecursive(sourceDir: string, destinationDir: string): Promise<void> {
  if (!(await existsPath(sourceDir))) {
    return;
  }

  await ensureDir(destinationDir);

  const entries = await glob("**/*", { cwd: sourceDir });
  for (const entry of entries) {
    const from = path.join(sourceDir, entry);
    const to = path.join(destinationDir, entry);
    const fileStat = await statPath(from);
    if (!fileStat?.isFile()) {
      continue;
    }

    await ensureDir(path.dirname(to));
    await Bun.write(to, Bun.file(from));
  }
}

export function createBuildManifest(routeAssets: Record<string, BuildRouteAsset>): BuildManifest {
  return {
    version: stableHash(JSON.stringify(routeAssets)),
    generatedAt: new Date().toISOString(),
    routes: routeAssets,
  };
}

export async function discoverFileSignature(rootDir: string): Promise<string> {
  const files = (await walkFiles(rootDir))
    .filter(file => !normalizeSlashes(file).includes("/node_modules/"))
    .sort();

  const signatureBits: string[] = [];
  for (const filePath of files) {
    const fileStat = await statPath(filePath);
    if (!fileStat?.isFile()) {
      continue;
    }
    const contentHash = stableHash(await Bun.file(filePath).bytes());
    signatureBits.push(`${normalizeSlashes(filePath)}:${contentHash}`);
  }

  return stableHash(signatureBits.join("|"));
}

export async function buildRouteManifest(config: ResolvedConfig): Promise<RouteManifest> {
  return scanRoutes(config.routesDir, {
    generatedMarkdownRootDir: path.resolve(config.cwd, ".rbssr/generated/markdown-routes"),
  });
}

