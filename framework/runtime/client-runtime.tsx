import { hydrateRoot } from "react-dom/client";
import { isDeferredToken } from "./deferred";
import type { RouteModuleBundle, RenderPayload } from "./types";
import { createRouteTree } from "./tree";

interface DeferredClientRuntime {
  get(id: string): Promise<unknown>;
}

declare global {
  interface Window {
    __RBSSR_DEFERRED__?: DeferredClientRuntime;
  }
}

function reviveDeferredPayload(payload: RenderPayload): RenderPayload {
  const sourceData = payload.data;
  if (!sourceData || Array.isArray(sourceData) || typeof sourceData !== "object") {
    return payload;
  }

  const runtime = window.__RBSSR_DEFERRED__;
  if (!runtime) {
    return payload;
  }

  const revivedData = { ...(sourceData as Record<string, unknown>) };
  for (const [key, value] of Object.entries(revivedData)) {
    if (!isDeferredToken(value)) {
      continue;
    }
    revivedData[key] = runtime.get(value.__rbssrDeferred);
  }

  return {
    ...payload,
    data: revivedData,
  };
}

function getPayload(): RenderPayload {
  const script = document.getElementById("__RBSSR_PAYLOAD__");
  if (!script) {
    throw new Error("Missing SSR payload script tag");
  }

  const raw = script.textContent ?? "{}";
  const parsed = JSON.parse(raw) as RenderPayload;
  return reviveDeferredPayload(parsed);
}

export function hydrateRoute(modules: RouteModuleBundle): void {
  const payload = getPayload();
  const container = document.getElementById("rbssr-root");
  if (!container) {
    throw new Error("Missing #rbssr-root hydration container");
  }

  const Leaf = modules.route.default;
  const tree = createRouteTree(modules, <Leaf />, payload);
  hydrateRoot(container, tree);
}
