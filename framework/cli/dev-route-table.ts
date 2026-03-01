import { statPath } from "../runtime/io";
import type { RouteManifest } from "../runtime/types";
import { ensureWithin } from "../runtime/utils";

export const RBSSR_DEV_RELOAD_TOPIC = "rbssr:reload";
export const RBSSR_DEV_WS_PATH = "/__rbssr/ws";

export type DevReloadReason =
  | "client-build"
  | "route-structure"
  | "server-runtime"
  | "markdown-route"
  | "config-restart";

export interface DevReloadMessage {
  token: number;
  reason: DevReloadReason;
}

function normalizeApiRoutePath(routePath: string): string {
  return routePath.replace(/\*[A-Za-z0-9_]+/g, "*");
}

async function serveDevClientAsset(devClientDir: string, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const relativePath = url.pathname.replace(/^\/__rbssr\/client\//, "");
  const resolvedPath = ensureWithin(devClientDir, relativePath);
  if (!resolvedPath) {
    return new Response("Not found", { status: 404 });
  }

  const stat = await statPath(resolvedPath);
  if (!stat?.isFile()) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(Bun.file(resolvedPath), {
    headers: {
      "cache-control": "no-store",
    },
  });
}

export function createDevRouteTable(options: {
  devClientDir: string;
  manifest: RouteManifest;
  handleFrameworkFetch: (request: Request) => Promise<Response>;
}): Record<string, Response | ((request: Request, server: Bun.Server<undefined>) => Response | Promise<Response> | void)> {
  const routes: Record<
    string,
    Response | ((request: Request, server: Bun.Server<undefined>) => Response | Promise<Response> | void)
  > = {
    [RBSSR_DEV_WS_PATH]: (request, server) => {
      const upgraded = server.upgrade(request);
      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
    },
    "/__rbssr/client/*": (request) => {
      return serveDevClientAsset(options.devClientDir, request);
    },
  };

  for (const apiRoute of options.manifest.api) {
    routes[normalizeApiRoutePath(apiRoute.routePath)] = (request) => {
      return options.handleFrameworkFetch(request);
    };
  }

  return routes;
}
