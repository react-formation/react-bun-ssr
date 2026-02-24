import { hydrateRoot } from "react-dom/client";
import type { RouteModuleBundle, RenderPayload } from "./types";
import { createRouteTree } from "./tree";

function getPayload(): RenderPayload {
  const script = document.getElementById("__RBSSR_PAYLOAD__");
  if (!script) {
    throw new Error("Missing SSR payload script tag");
  }

  const raw = script.textContent ?? "{}";
  return JSON.parse(raw) as RenderPayload;
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
