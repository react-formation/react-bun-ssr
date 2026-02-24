import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "bun:test";
import { createServer } from "../../framework/runtime/server";

const tmpDirs: string[] = [];

afterEach(() => {
  for (const dir of tmpDirs.splice(0, tmpDirs.length)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function writeFixture(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(process.cwd(), ".rbssr-server-"));
  tmpDirs.push(root);

  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, "utf8");
  }

  return root;
}

describe("createServer integration", () => {
  it("renders SSR HTML with loader data", async () => {
    const runtimeImport = pathToFileURL(path.resolve(process.cwd(), "framework/runtime/route-api.ts")).href;
    const cwd = writeFixture({
      "app/root.tsx": `import { Outlet } from "${runtimeImport}";
      export default function Root(){ return <div><Outlet /></div>; }
      export function NotFound(){ return <h1>missing</h1>; }`,
      "app/routes/index.tsx": `import { useLoaderData } from "${runtimeImport}";
      export function loader(){ return { message: "SSR works" }; }
      export default function Index(){ const data = useLoaderData<{ message: string }>(); return <h1>{data.message}</h1>; }`,
      "app/routes/submit.tsx": `import { redirect } from "${runtimeImport}";
      export async function action(){ return redirect("/"); }
      export default function Submit(){ return <div>submit</div>; }`,
      "app/routes/error.tsx": `import { useRouteError } from "${runtimeImport}";
      export function loader(){ throw new Error("loader boom"); }
      export function ErrorBoundary(){ const err = useRouteError(); return <p>boundary:{String((err as { message?: string })?.message ?? err)}</p>; }
      export default function ErrorRoute(){ return <div>never</div>; }`,
      "app/routes/api/hello.ts": `export function GET(){ return Response.json({ ok: true }); }`,
    });

    const server = createServer(
      {
        appDir: path.join(cwd, "app"),
        mode: "development",
      },
      {
        dev: true,
        devAssets: {
          index: { script: "/__rbssr/client/route__index.js", css: [] },
          submit: { script: "/__rbssr/client/route__submit.js", css: [] },
          error: { script: "/__rbssr/client/route__error.js", css: [] },
        },
      },
    );

    const response = await server.fetch(new Request("http://localhost/"));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("SSR works");

    const notFound = await server.fetch(new Request("http://localhost/does-not-exist"));
    expect(notFound.status).toBe(404);
    expect(await notFound.text()).toContain("missing");

    const redirectResponse = await server.fetch(
      new Request("http://localhost/submit", {
        method: "POST",
      }),
    );

    expect(redirectResponse.status).toBe(302);
    expect(redirectResponse.headers.get("location")).toBe("/");

    const apiResponse = await server.fetch(new Request("http://localhost/api/hello"));
    expect(apiResponse.status).toBe(200);
    expect(await apiResponse.json()).toEqual({ ok: true });

    const api405 = await server.fetch(
      new Request("http://localhost/api/hello", {
        method: "DELETE",
      }),
    );
    expect(api405.status).toBe(405);

    const boundaryResponse = await server.fetch(new Request("http://localhost/error"));
    expect(boundaryResponse.status).toBe(500);
    const boundaryHtml = await boundaryResponse.text();
    expect(boundaryHtml).toContain("boundary:");
    expect(boundaryHtml).toContain("loader boom");
  });
});
