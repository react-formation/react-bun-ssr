import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import { ensureDir, makeTempDir, removePath } from "../../framework/runtime/io";
import { createServer } from "../../framework/runtime/server";

const tmpDirs: string[] = [];

afterEach(async () => {
  for (const dir of tmpDirs.splice(0, tmpDirs.length)) {
    await removePath(dir);
  }
});

async function writeFixture(files: Record<string, string>): Promise<string> {
  const root = await makeTempDir("rbssr-server");
  tmpDirs.push(root);

  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(root, relativePath);
    await ensureDir(path.dirname(fullPath));
    await Bun.write(fullPath, content);
  }

  return root;
}

describe("createServer integration", () => {
  it("renders SSR HTML with loader data", async () => {
    const runtimeImport = "react-bun-ssr/route";
    const cwd = await writeFixture({
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
      "app/routes/styled.tsx": `import styles from "./styled.module.css";
      export default function Styled(){ return <div className={styles.hero}>styled-route</div>; }`,
      "app/routes/styled.module.css": `.hero { color: red; }`,
      "app/routes/guide.md": `# Markdown Guide

This route is **native markdown**.`,
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
          styled: { script: "/__rbssr/client/route__styled.js", css: [] },
          guide: { script: "/__rbssr/client/route__guide.js", css: [] },
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

    const styledResponse = await server.fetch(new Request("http://localhost/styled"));
    expect(styledResponse.status).toBe(200);
    const styledHtml = await styledResponse.text();
    expect(styledHtml).toContain("styled-route");
    expect(styledHtml).toContain("class=\"hero_");
    expect(styledHtml).not.toContain("undefined");

    const markdownResponse = await server.fetch(new Request("http://localhost/guide"));
    expect(markdownResponse.status).toBe(200);
    const markdownHtml = await markdownResponse.text();
    expect(markdownHtml).toContain("Markdown Guide");
    expect(markdownHtml).toContain("native markdown");
  });
});
