import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import { toAbsoluteUrl } from "../../app/lib/site.ts";
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
    (globalThis as { __rbssrOnCatchOrder?: string[] }).__rbssrOnCatchOrder = [];
    (globalThis as { __rbssrOnErrorOrder?: string[] }).__rbssrOnErrorOrder = [];
    const cwd = await writeFixture({
      "app/root.tsx": `import { Outlet } from "${runtimeImport}";
      import styles from "./root.module.css";
      export default function Root(){ return <div className={styles.shell}><Outlet /></div>; }
      export function NotFound(){ return <h1>missing</h1>; }
      export function onCatch(){
        const g = globalThis as { __rbssrOnCatchOrder?: string[] };
        g.__rbssrOnCatchOrder ??= [];
        g.__rbssrOnCatchOrder.push("root");
      }
      export function onError(){
        const g = globalThis as { __rbssrOnErrorOrder?: string[] };
        g.__rbssrOnErrorOrder ??= [];
        g.__rbssrOnErrorOrder.push("root");
      }`,
      "app/root.module.css": `.shell { color: rgb(17, 31, 45); }`,
      "app/routes/index.tsx": `import { useLoaderData } from "${runtimeImport}";
      export function loader(){ return { message: "SSR works" }; }
      export default function Index(){ const data = useLoaderData<{ message: string }>(); return <h1>{data.message}</h1>; }`,
      "app/routes/submit.tsx": `import { redirect } from "${runtimeImport}";
      export async function action(){ return redirect("/"); }
      export default function Submit(){ return <div>submit</div>; }`,
      "app/routes/error.tsx": `import { useRouteError } from "${runtimeImport}";
      export function loader(){ throw new Error("loader boom"); }
      export function onError(){
        const g = globalThis as { __rbssrOnErrorOrder?: string[] };
        g.__rbssrOnErrorOrder ??= [];
        g.__rbssrOnErrorOrder.push("route");
      }
      export function ErrorBoundary(){ const err = useRouteError(); return <p>boundary:{String((err as { message?: string })?.message ?? err)}</p>; }
      export default function ErrorRoute(){ return <div>never</div>; }`,
      "app/routes/caught.tsx": `import { routeError, isRouteErrorResponse, useRouteError } from "${runtimeImport}";
      export function loader(){ return routeError(418, { reason: "teapot" }); }
      export function onCatch(){
        const g = globalThis as { __rbssrOnCatchOrder?: string[] };
        g.__rbssrOnCatchOrder ??= [];
        g.__rbssrOnCatchOrder.push("route");
      }
      export function CatchBoundary(){
        const err = useRouteError();
        return <p>caught:{isRouteErrorResponse(err) ? err.status : "unknown"}</p>;
      }
      export default function CaughtRoute(){ return <div>never</div>; }`,
      "app/routes/missing-caught.tsx": `import { notFound } from "${runtimeImport}";
      export function loader(){ return notFound({ slug: "missing-caught" }); }
      export function NotFound(){ return <h1>module-notfound</h1>; }
      export default function MissingCaught(){ return <div>never</div>; }`,
      "app/routes/styled.tsx": `import styles from "./styled.module.css";
      export default function Styled(){ return <div className={styles.hero}>styled-route</div>; }`,
      "app/routes/styled.module.css": `.hero { color: red; }`,
      "app/routes/guide.md": `# Markdown Guide

This route is **native markdown**.`,
      "app/routes/deferred.tsx": `import { Suspense, use } from "react";
      import { defer, useLoaderData } from "${runtimeImport}";
      export function loader(){
        return defer({
          fast: "ready",
          slow: Promise.resolve("slow-value"),
        });
      }
      function SlowValue(props: { value: Promise<string> }) {
        const value = use(props.value);
        return <p>{value}</p>;
      }
      export default function DeferredRoute(){
        const data = useLoaderData<{ fast: string; slow: Promise<string> }>();
        return (
          <section>
            <h1>{data.fast}</h1>
            <Suspense fallback={<p>loading...</p>}>
              <SlowValue value={data.slow} />
            </Suspense>
          </section>
        );
      }`,
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
          index: { script: "/__rbssr/client/route__index.js", css: ["/__rbssr/client/shared.css"] },
          submit: { script: "/__rbssr/client/route__submit.js", css: ["/__rbssr/client/shared.css"] },
          error: { script: "/__rbssr/client/route__error.js", css: ["/__rbssr/client/shared.css"] },
          caught: { script: "/__rbssr/client/route__caught.js", css: ["/__rbssr/client/shared.css"] },
          missing_caught: { script: "/__rbssr/client/route__missing_caught.js", css: ["/__rbssr/client/shared.css"] },
          styled: { script: "/__rbssr/client/route__styled.js", css: ["/__rbssr/client/shared.css"] },
          guide: { script: "/__rbssr/client/route__guide.js", css: ["/__rbssr/client/shared.css"] },
          deferred: { script: "/__rbssr/client/route__deferred.js", css: ["/__rbssr/client/shared.css"] },
        },
      },
    );

    const response = await server.fetch(new Request("http://localhost/"));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("SSR works");

    const notFound = await server.fetch(new Request("http://localhost/does-not-exist"));
    expect(notFound.status).toBe(404);
    const notFoundHtml = await notFound.text();
    expect(notFoundHtml).toContain("missing");
    expect(notFoundHtml).toContain("class=\"shell_");
    expect(notFoundHtml).toContain("/__rbssr/client/shared.css?v=0");

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
    expect((globalThis as { __rbssrOnErrorOrder?: string[] }).__rbssrOnErrorOrder).toEqual(["route", "root"]);

    const caughtResponse = await server.fetch(new Request("http://localhost/caught"));
    expect(caughtResponse.status).toBe(418);
    const caughtHtml = await caughtResponse.text();
    expect(caughtHtml).toContain("caught:");
    expect(caughtHtml).toContain("418");
    expect((globalThis as { __rbssrOnCatchOrder?: string[] }).__rbssrOnCatchOrder).toEqual(["route", "root"]);

    const missingCaughtResponse = await server.fetch(new Request("http://localhost/missing-caught"));
    expect(missingCaughtResponse.status).toBe(404);
    expect(await missingCaughtResponse.text()).toContain("module-notfound");

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

    const deferredResponse = await server.fetch(new Request("http://localhost/deferred"));
    expect(deferredResponse.status).toBe(200);
    const deferredHtml = await deferredResponse.text();
    expect(deferredHtml).toContain("slow-value");
    expect(deferredHtml).toContain("__rbssrDeferred");
    expect(deferredHtml).toContain("__RBSSR_DEFERRED__.resolve");
  });

  it("applies production static cache headers", async () => {
    const runtimeImport = "react-bun-ssr/route";
    const cwd = await writeFixture({
      "app/root.tsx": `import { Outlet } from "${runtimeImport}";
      export default function Root(){ return <div><Outlet /></div>; }`,
      "app/routes/index.tsx": `export default function Index(){ return <h1>home</h1>; }`,
      "dist/client/route__index-abc123.js": "console.log('chunk');",
      "dist/client/route__index-abc123.css": ".hero{color:red;}",
      "app/public/logo.png": "png-bytes",
      "app/public/sitemap.xml": `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`,
      "app/public/robots.txt": `User-agent: *\nAllow: /\n\nSitemap: ${toAbsoluteUrl("/sitemap.xml")}\n`,
    });

    const server = createServer({
      appDir: path.join(cwd, "app"),
      distDir: path.join(cwd, "dist"),
      mode: "production",
    });

    const jsResponse = await server.fetch(
      new Request("http://localhost/client/route__index-abc123.js"),
    );
    expect(jsResponse.status).toBe(200);
    expect(jsResponse.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");

    const cssResponse = await server.fetch(
      new Request("http://localhost/client/route__index-abc123.css"),
    );
    expect(cssResponse.status).toBe(200);
    expect(cssResponse.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");

    const logoGet = await server.fetch(new Request("http://localhost/logo.png"));
    expect(logoGet.status).toBe(200);
    expect(logoGet.headers.get("cache-control")).toBe("public, max-age=3600");

    const logoHead = await server.fetch(
      new Request("http://localhost/logo.png", { method: "HEAD" }),
    );
    expect(logoHead.status).toBe(200);
    expect(logoHead.headers.get("cache-control")).toBe("public, max-age=3600");
    expect(await logoHead.text()).toBe("");

    const sitemapGet = await server.fetch(new Request("http://localhost/sitemap.xml"));
    expect(sitemapGet.status).toBe(200);
    expect(sitemapGet.headers.get("cache-control")).toBe("public, max-age=3600");
    expect(sitemapGet.headers.get("content-type")?.includes("xml")).toBe(true);

    const sitemapHead = await server.fetch(
      new Request("http://localhost/sitemap.xml", { method: "HEAD" }),
    );
    expect(sitemapHead.status).toBe(200);
    expect(sitemapHead.headers.get("cache-control")).toBe("public, max-age=3600");
    expect(await sitemapHead.text()).toBe("");

    const robotsGet = await server.fetch(new Request("http://localhost/robots.txt"));
    expect(robotsGet.status).toBe(200);
    expect(robotsGet.headers.get("cache-control")).toBe("public, max-age=3600");
    expect(await robotsGet.text()).toContain(`Sitemap: ${toAbsoluteUrl("/sitemap.xml")}`);
  });

  it("renders routes in production when server bytecode is disabled", async () => {
    const runtimeImport = "react-bun-ssr/route";
    const cwd = await writeFixture({
      "app/root.tsx": `import { Outlet } from "${runtimeImport}";
      export default function Root(){ return <div><Outlet /></div>; }`,
      "app/routes/index.tsx": `export default function Index(){ return <h1>prod-no-bytecode</h1>; }`,
    });

    const server = createServer({
      appDir: path.join(cwd, "app"),
      distDir: path.join(cwd, "dist"),
      mode: "production",
      serverBytecode: false,
    });

    const response = await server.fetch(new Request("http://localhost/"));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("prod-no-bytecode");
  });

  it("streams transition endpoint chunks for page, catch, error, and not-found states", async () => {
    const runtimeImport = "react-bun-ssr/route";
    const cwd = await writeFixture({
      "app/root.tsx": `import { Outlet } from "${runtimeImport}";
      import styles from "./root.module.css";
      export default function Root(){ return <div className={styles.shell}><Outlet /></div>; }
      export function NotFound(){ return <h1>missing</h1>; }`,
      "app/root.module.css": `.shell { color: rgb(17, 31, 45); }`,
      "app/routes/index.tsx": `export default function Index(){ return <h1>home</h1>; }`,
      "app/routes/deferred.tsx": `import { defer } from "${runtimeImport}";
      export function loader(){ return defer({ slow: Promise.resolve("done") }); }
      export default function Deferred(){ return <h1>deferred</h1>; }`,
      "app/routes/caught.tsx": `import { routeError } from "${runtimeImport}";
      export function loader(){ return routeError(418, { reason: "teapot" }); }
      export function CatchBoundary(){ return <h1>caught-boundary</h1>; }
      export default function Caught(){ return <h1>caught</h1>; }`,
      "app/routes/boom.tsx": `export function loader(){ throw new Error("boom"); }
      export function ErrorBoundary(){ return <h1>errored</h1>; }
      export default function Boom(){ return <h1>boom</h1>; }`,
    });

    const server = createServer(
      {
        appDir: path.join(cwd, "app"),
        mode: "development",
      },
      {
        dev: true,
        devAssets: {
          index: { script: "/__rbssr/client/route__index.js", css: ["/__rbssr/client/shared.css"] },
          deferred: { script: "/__rbssr/client/route__deferred.js", css: ["/__rbssr/client/shared.css"] },
          caught: { script: "/__rbssr/client/route__caught.js", css: ["/__rbssr/client/shared.css"] },
          boom: { script: "/__rbssr/client/route__boom.js", css: ["/__rbssr/client/shared.css"] },
        },
      },
    );

    const deferredTransition = await server.fetch(
      new Request("http://localhost/__rbssr/transition?to=/deferred"),
    );
    expect(deferredTransition.status).toBe(200);
    expect(deferredTransition.headers.get("content-type")).toContain("application/x-ndjson");

    const deferredLines = (await deferredTransition.text())
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => JSON.parse(line) as { type: string; [key: string]: unknown });
    expect(deferredLines[0]?.type).toBe("initial");
    expect(deferredLines[0]?.kind).toBe("page");
    expect((deferredLines[0]?.payload as { routeId?: string })?.routeId).toBe("deferred");
    expect(deferredLines.some(line => line.type === "deferred")).toBe(true);

    const caughtTransition = await server.fetch(
      new Request("http://localhost/__rbssr/transition?to=/caught"),
    );
    const caughtLines = (await caughtTransition.text())
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => JSON.parse(line) as { type: string; [key: string]: unknown });
    expect(caughtLines[0]?.type).toBe("initial");
    expect(caughtLines[0]?.kind).toBe("catch");
    expect(caughtLines[0]?.status).toBe(418);

    const errorTransition = await server.fetch(
      new Request("http://localhost/__rbssr/transition?to=/boom"),
    );
    const errorLines = (await errorTransition.text())
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => JSON.parse(line) as { type: string; [key: string]: unknown });
    expect(errorLines[0]?.type).toBe("initial");
    expect(errorLines[0]?.kind).toBe("error");
    expect(errorLines[0]?.status).toBe(500);

    const notFoundTransition = await server.fetch(
      new Request("http://localhost/__rbssr/transition?to=/missing"),
    );
    const notFoundLines = (await notFoundTransition.text())
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => JSON.parse(line) as { type: string; [key: string]: unknown });
    expect(notFoundLines[0]?.type).toBe("initial");
    expect(notFoundLines[0]?.kind).toBe("not_found");
    expect(notFoundLines[0]?.status).toBe(404);
    expect(String(notFoundLines[0]?.head ?? "")).toContain("/__rbssr/client/shared.css?v=0");
  });

  it("applies configured headers and lets config override defaults", async () => {
    const runtimeImport = "react-bun-ssr/route";
    const cwd = await writeFixture({
      "app/root.tsx": `import { Outlet } from "${runtimeImport}";
      export default function Root(){ return <main><Outlet /></main>; }`,
      "app/routes/docs/index.tsx": `export default function Docs(){ return <h1>docs</h1>; }`,
      "app/routes/api/hello.ts": `export function GET(){ return Response.json({ ok: true }); }`,
      "dist/client/route__docs__index-abc123.js": "console.log('docs-chunk');",
      "app/public/robots.txt": "User-agent: *",
    });

    const server = createServer({
      appDir: path.join(cwd, "app"),
      distDir: path.join(cwd, "dist"),
      mode: "production",
      headers: [
        {
          source: "/docs/**",
          headers: {
            "x-docs-header": "enabled",
          },
        },
        {
          source: "/api/**",
          headers: {
            "x-api-header": "enabled",
          },
        },
        {
          source: "/client/**",
          headers: {
            "cache-control": "public, max-age=120",
          },
        },
      ],
    });

    const docsGet = await server.fetch(new Request("http://localhost/docs"));
    expect(docsGet.status).toBe(200);
    expect(docsGet.headers.get("x-docs-header")).toBe("enabled");

    const docsHead = await server.fetch(new Request("http://localhost/docs", { method: "HEAD" }));
    expect(docsHead.status).toBe(200);
    expect(docsHead.headers.get("x-docs-header")).toBe("enabled");
    expect(await docsHead.text()).toBe("");

    const apiResponse = await server.fetch(new Request("http://localhost/api/hello"));
    expect(apiResponse.status).toBe(200);
    expect(apiResponse.headers.get("x-api-header")).toBe("enabled");

    const chunkResponse = await server.fetch(
      new Request("http://localhost/client/route__docs__index-abc123.js"),
    );
    expect(chunkResponse.status).toBe(200);
    expect(chunkResponse.headers.get("cache-control")).toBe("public, max-age=120");

    const robotsResponse = await server.fetch(new Request("http://localhost/robots.txt"));
    expect(robotsResponse.status).toBe(200);
    expect(robotsResponse.headers.get("cache-control")).toBe("public, max-age=3600");
  });

  it("keeps dev internal endpoints and dev static files non-cacheable", async () => {
    const runtimeImport = "react-bun-ssr/route";
    const cwd = await writeFixture({
      "app/root.tsx": `import { Outlet } from "${runtimeImport}";
      export default function Root(){ return <main><Outlet /></main>; }`,
      "app/routes/index.tsx": `export default function Index(){ return <h1>dev</h1>; }`,
    });

    const devClientDir = path.join(process.cwd(), ".rbssr/dev/client");
    await ensureDir(devClientDir);
    const devAssetPath = path.join(devClientDir, "integration-header-test.js");
    await Bun.write(devAssetPath, "console.log('dev-asset');");

    try {
      const server = createServer(
        {
          appDir: path.join(cwd, "app"),
          mode: "development",
        },
        {
          dev: true,
          reloadVersion: () => 1,
        },
      );

      const versionResponse = await server.fetch(new Request("http://localhost/__rbssr/version"));
      expect(versionResponse.status).toBe(200);
      const versionCache = versionResponse.headers.get("cache-control") ?? "";
      expect(versionCache.includes("no-store") || versionCache.includes("no-cache")).toBe(true);

      const devAssetResponse = await server.fetch(
        new Request("http://localhost/__rbssr/client/integration-header-test.js"),
      );
      expect(devAssetResponse.status).toBe(200);
      expect(devAssetResponse.headers.get("cache-control")).toBe("no-store");
    } finally {
      await Bun.write(devAssetPath, "");
      await removePath(devAssetPath);
    }
  });
});
