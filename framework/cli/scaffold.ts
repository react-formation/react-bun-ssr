import path from "node:path";
import { existsPath, writeText } from "../runtime/io";

interface ScaffoldFile {
  filePath: string;
  content: string;
}

interface FrameworkPackageManifest {
  devDependencies?: Record<string, string>;
}

const FRAMEWORK_DEPENDENCY_VERSION = "latest";
const DEFAULT_TYPESCRIPT_VERSION = "^5";
const DEFAULT_BUN_TYPES_VERSION = "latest";
const DEFAULT_REACT_TYPES_VERSION = "^19";
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <rect width="96" height="96" rx="20" fill="#111827"/>
  <path d="M25 28h20c13.807 0 25 11.193 25 25S58.807 78 45 78H25V28Zm18 40c8.837 0 16-7.163 16-16s-7.163-16-16-16h-8v32h8Z" fill="#f9fafb"/>
</svg>
`;

let frameworkPackageManifestPromise: Promise<FrameworkPackageManifest> | null = null;

async function writeIfMissing(filePath: string, content: string, force: boolean): Promise<void> {
  if (!force && await existsPath(filePath)) {
    return;
  }

  await writeText(filePath, content);
}

function getFrameworkPackageManifest(): Promise<FrameworkPackageManifest> {
  if (!frameworkPackageManifestPromise) {
    const packageJsonPath = path.resolve(import.meta.dir, "../../package.json");
    frameworkPackageManifestPromise = Bun.file(packageJsonPath).json() as Promise<FrameworkPackageManifest>;
  }

  return frameworkPackageManifestPromise;
}

function normalizePackageName(cwd: string): string {
  const baseName = path.basename(path.resolve(cwd));
  const normalized = baseName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/[._-]{2,}/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "");

  return normalized || "rbssr-app";
}

function createPackageJsonContent(options: {
  cwd: string;
  frameworkVersion: string;
  typescriptVersion: string;
  bunTypesVersion: string;
  reactTypesVersion: string;
  reactDomTypesVersion: string;
}): string {
  const packageJson = {
    name: normalizePackageName(options.cwd),
    version: "0.0.0",
    private: true,
    type: "module",
    scripts: {
      dev: "rbssr dev",
      build: "rbssr build",
      start: "rbssr start",
      typecheck: "bunx tsc --noEmit",
    },
    dependencies: {
      "react-bun-ssr": options.frameworkVersion,
      react: "^19",
      "react-dom": "^19",
    },
    devDependencies: {
      "@types/react": options.reactTypesVersion,
      "@types/react-dom": options.reactDomTypesVersion,
      "bun-types": options.bunTypesVersion,
      typescript: options.typescriptVersion,
    },
  };

  return `${JSON.stringify(packageJson, null, 2)}\n`;
}

function createTsconfigContent(): string {
  const tsconfig = {
    compilerOptions: {
      target: "ESNext",
      module: "Preserve",
      moduleResolution: "Bundler",
      jsx: "react-jsx",
      strict: true,
      types: ["bun-types"],
    },
    include: ["app", "rbssr.config.ts"],
  };

  return `${JSON.stringify(tsconfig, null, 2)}\n`;
}

function createGitignoreContent(): string {
  return `node_modules
dist
.rbssr
.env
.env.local
.DS_Store
`;
}

async function templateFiles(cwd: string): Promise<ScaffoldFile[]> {
  const frameworkPackage = await getFrameworkPackageManifest();
  const typescriptVersion = frameworkPackage.devDependencies?.typescript ?? DEFAULT_TYPESCRIPT_VERSION;
  const bunTypesVersion = frameworkPackage.devDependencies?.["bun-types"] ?? DEFAULT_BUN_TYPES_VERSION;
  const reactTypesVersion = frameworkPackage.devDependencies?.["@types/react"] ?? DEFAULT_REACT_TYPES_VERSION;
  const reactDomTypesVersion = frameworkPackage.devDependencies?.["@types/react-dom"] ?? DEFAULT_REACT_TYPES_VERSION;

  return [
    {
      filePath: path.join(cwd, "package.json"),
      content: createPackageJsonContent({
        cwd,
        frameworkVersion: FRAMEWORK_DEPENDENCY_VERSION,
        typescriptVersion,
        bunTypesVersion,
        reactTypesVersion,
        reactDomTypesVersion,
      }),
    },
    {
      filePath: path.join(cwd, "tsconfig.json"),
      content: createTsconfigContent(),
    },
    {
      filePath: path.join(cwd, ".gitignore"),
      content: createGitignoreContent(),
    },
    {
      filePath: path.join(cwd, "rbssr.config.ts"),
      content: `import { defineConfig } from "react-bun-ssr";

export default defineConfig({
  appDir: "app",
  port: 3000,
});
`,
    },
    {
      filePath: path.join(cwd, "app/root.tsx"),
      content: `import { Outlet } from "react-bun-ssr/route";
import styles from "./root.module.css";

export default function RootLayout() {
  return (
    <main className={styles.shell}>
      <header className={styles.top}>
        <h1>react-bun-ssr</h1>
      </header>
      <section className={styles.content}>
        <Outlet />
      </section>
    </main>
  );
}

export function head() {
  return <title>react-bun-ssr app</title>;
}
`,
    },
    {
      filePath: path.join(cwd, "app/root.module.css"),
      content: `:global(*) {
  box-sizing: border-box;
}

:global(html) {
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  background: linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%);
  color: #0f172a;
}

:global(body) {
  margin: 0;
}

.shell {
  min-height: 100vh;
  width: min(100%, 72rem);
  margin: 0 auto;
  padding: 3rem 1.5rem 4rem;
}

.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
}

.top h1 {
  margin: 0;
  font-size: clamp(2rem, 5vw, 3.5rem);
  line-height: 1;
  letter-spacing: -0.04em;
}

.content {
  padding: 1.5rem;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 1.5rem;
  background: rgba(255, 255, 255, 0.84);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(18px);
}
`,
    },
    {
      filePath: path.join(cwd, "app/routes/index.tsx"),
      content: `import { useLoaderData } from "react-bun-ssr/route";

export function loader() {
  return {
    message: "Hello from SSR",
    now: new Date().toISOString(),
  };
}

export default function IndexRoute() {
  const data = useLoaderData<{ message: string; now: string }>();

  return (
    <section>
      <p>{data.message}</p>
      <small>{data.now}</small>
    </section>
  );
}
`,
    },
    {
      filePath: path.join(cwd, "app/routes/api/health.ts"),
      content: `export function GET() {
  return Response.json({ status: "ok" });
}
`,
    },
    {
      filePath: path.join(cwd, "app/middleware.ts"),
      content: `import type { Middleware } from "react-bun-ssr/route";

export const middleware: Middleware = async (ctx, next) => {
  const response = await next();
  response.headers.set("x-powered-by", "react-bun-ssr");
  return response;
};
`,
    },
    {
      filePath: path.join(cwd, "app/public/favicon.svg"),
      content: FAVICON_SVG,
    },
  ];
}

export async function scaffoldApp(cwd: string, options: { force: boolean }): Promise<void> {
  for (const file of await templateFiles(cwd)) {
    await writeIfMissing(file.filePath, file.content, options.force);
  }
}
