import path from "node:path";
import { afterEach, describe, expect, it } from "bun:test";
import { createServer } from "../../../framework/runtime/server";
import { createFixtureApp } from "../helpers/fixture-app";
import { createTempDirRegistry } from "../helpers/temp-dir";

const tempDirs = createTempDirRegistry();

afterEach(async () => {
  await tempDirs.cleanup();
});

function createDevAssets(routeIds: string[]) {
  return Object.fromEntries(
    routeIds.map(routeId => [
      routeId,
      {
        script: `/__rbssr/client/route__${routeId}.js`,
        css: ["/__rbssr/client/shared.css"],
      },
    ]),
  );
}

describe("server-only route companions", () => {
  it("loads *.server modules for page loaders, api handlers, and global middleware", async () => {
    const runtimeImport = "react-bun-ssr/route";
    const root = await createFixtureApp(tempDirs, {
      "app/root.tsx": `
        import { Outlet } from "${runtimeImport}";
        export default function Root(){ return <main><Outlet /></main>; }
      `,
      "app/root.server.tsx": `
        export function head(){ return <title>Server Companion</title>; }
      `,
      "app/middleware.server.ts": `
        export default async function middleware(ctx, next) {
          ctx.locals.viewer = "alice";
          return next();
        }
      `,
      "app/routes/index.tsx": `
        import { useActionState } from "react";
        import { createRouteAction, useLoaderData } from "${runtimeImport}";
        export const action = createRouteAction<{ ok?: boolean; error?: string; name?: string; viewer?: string }>();
        export default function Index() {
          const data = useLoaderData<{ dbType: string; viewer: string }>();
          const [state, formAction] = useActionState(action, {});
          return (
            <>
              <h1>{data.dbType}:{data.viewer}</h1>
              <form action={formAction}>
                <button type="submit">submit</button>
                {state.error ? <p>{state.error}</p> : null}
              </form>
            </>
          );
        }
      `,
      "app/routes/index.server.tsx": `
        import { Database } from "bun:sqlite";
        const db = new Database(":memory:");
        db.exec("create table if not exists sessions (id integer primary key autoincrement, token text);");
        db.exec("insert into sessions (token) values ('abc123');");

        export function loader(ctx) {
          const row = db.query("select token from sessions limit 1").get();
          ctx.response.headers.set("x-session-token", String(row?.token ?? "missing"));
          return {
            dbType: typeof Database,
            viewer: String(ctx.locals.viewer ?? "missing"),
          };
        }

        export function action(ctx) {
          const name = String(ctx.formData?.get("name") ?? "").trim();
          if (!name) {
            ctx.response.cookies.set("flash", "missing-name", { path: "/", httpOnly: true });
            return { error: "Name required", viewer: String(ctx.locals.viewer ?? "missing") };
          }

          return { ok: true, name, viewer: String(ctx.locals.viewer ?? "missing") };
        }
      `,
      "app/routes/api/session.server.ts": `
        import { Database } from "bun:sqlite";
        const db = new Database(":memory:");
        db.exec("create table if not exists users (id integer primary key autoincrement, name text);");
        db.exec("insert into users (name) values ('alice');");

        export function GET(ctx) {
          const row = db.query("select name from users limit 1").get();
          return { ok: true, viewer: ctx.locals.viewer, name: row?.name };
        }
      `,
    }, "rbssr-server-only");

    const server = createServer(
      { appDir: path.join(root, "app"), mode: "development" },
      {
        dev: true,
        devAssets: createDevAssets(["index"]),
        reloadVersion: () => 1,
      },
    );

    const pageResponse = await server.fetch(new Request("http://localhost/"));
    expect(pageResponse.status).toBe(200);
    const pageHtml = await pageResponse.text();
    expect(pageHtml).toContain("function<!-- -->:<!-- -->alice");
    expect(pageResponse.headers.get("x-session-token")).toBe("abc123");

    const apiResponse = await server.fetch(new Request("http://localhost/api/session"));
    expect(apiResponse.status).toBe(200);
    expect(await apiResponse.json()).toEqual({ ok: true, viewer: "alice", name: "alice" });

    const actionResponse = await server.fetch(new Request("http://localhost/__rbssr/action?to=/", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "name=",
    }));
    expect(actionResponse.status).toBe(200);
    expect(await actionResponse.json()).toEqual({
      type: "data",
      status: 200,
      data: { error: "Name required", viewer: "alice" },
    });
    expect(actionResponse.headers.get("set-cookie")).toContain("flash=missing-name");
  });

  it("loads *.server modules in production mode with bytecode enabled", async () => {
    const runtimeImport = "react-bun-ssr/route";
    const root = await createFixtureApp(tempDirs, {
      "app/root.tsx": `
        import { Outlet } from "${runtimeImport}";
        export default function Root(){ return <main><Outlet /></main>; }
      `,
      "app/middleware.server.ts": `
        export default async function middleware(ctx, next) {
          ctx.locals.viewer = "alice";
          return next();
        }
      `,
      "app/routes/index.tsx": `
        import { useLoaderData } from "${runtimeImport}";
        export default function Index() {
          const data = useLoaderData<{ message: string; viewer: string }>();
          return <h1>{data.message}:{data.viewer}</h1>;
        }
      `,
      "app/routes/index.server.tsx": `
        import { Database } from "bun:sqlite";
        const db = new Database(":memory:");
        db.exec("create table if not exists posts (id integer primary key autoincrement, title text);");
        db.exec("insert into posts (title) values ('hello');");

        export function loader(ctx) {
          const row = db.query("select title from posts limit 1").get();
          return {
            message: String(row?.title ?? "missing"),
            viewer: String(ctx.locals.viewer ?? "missing"),
          };
        }
      `,
      "app/routes/api/session.server.ts": `
        export function GET(ctx) {
          return { ok: true, viewer: String(ctx.locals.viewer ?? "missing") };
        }
      `,
    }, "rbssr-server-only-prod-bytecode");

    const server = createServer({
      appDir: path.join(root, "app"),
      mode: "production",
    });

    const pageResponse = await server.fetch(new Request("http://localhost/"));
    expect(pageResponse.status).toBe(200);
    expect(await pageResponse.text()).toContain("hello<!-- -->:<!-- -->alice");

    const apiResponse = await server.fetch(new Request("http://localhost/api/session"));
    expect(apiResponse.status).toBe(200);
    expect(await apiResponse.json()).toEqual({ ok: true, viewer: "alice" });
  });
});
