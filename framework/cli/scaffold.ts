import fs from "node:fs";
import path from "node:path";

interface ScaffoldFile {
  filePath: string;
  content: string;
}

function writeIfMissing(filePath: string, content: string, force: boolean): void {
  if (!force && fs.existsSync(filePath)) {
    return;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function templateFiles(cwd: string): ScaffoldFile[] {
  return [
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

export default function RootLayout() {
  return (
    <main className="shell">
      <header className="top">
        <h1>react-bun-ssr</h1>
      </header>
      <Outlet />
    </main>
  );
}

export function head() {
  return <title>react-bun-ssr app</title>;
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
  ];
}

export function scaffoldApp(cwd: string, options: { force: boolean }): void {
  for (const file of templateFiles(cwd)) {
    writeIfMissing(file.filePath, file.content, options.force);
  }
}
