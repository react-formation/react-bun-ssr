import {
  Children,
  cloneElement,
  isValidElement,
  type ComponentType,
  type ReactNode,
} from "react";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import type {
  HydrationDocumentAssets,
  RenderPayload,
  RouteModule,
  RouteModuleBundle,
} from "./types";
import { safeJsonSerialize } from "./utils";
import { createRouteTree } from "./tree";

function resolveErrorBoundary(modules: RouteModuleBundle): ComponentType<{ error: unknown }> | null {
  if (modules.route.ErrorBoundary) {
    return modules.route.ErrorBoundary;
  }

  for (let index = modules.layouts.length - 1; index >= 0; index -= 1) {
    const candidate = modules.layouts[index]!.ErrorBoundary;
    if (candidate) {
      return candidate;
    }
  }

  return modules.root.ErrorBoundary ?? null;
}

function resolveNotFoundBoundary(modules: RouteModuleBundle): ComponentType | null {
  if (modules.route.NotFound) {
    return modules.route.NotFound;
  }

  for (let index = modules.layouts.length - 1; index >= 0; index -= 1) {
    const candidate = modules.layouts[index]!.NotFound;
    if (candidate) {
      return candidate;
    }
  }

  return modules.root.NotFound ?? null;
}

export function renderPageApp(modules: RouteModuleBundle, payload: RenderPayload): string {
  const Leaf = modules.route.default;
  return renderToString(createRouteTree(modules, <Leaf />, payload));
}

export function renderErrorApp(
  modules: RouteModuleBundle,
  payload: RenderPayload,
  error: unknown,
): string | null {
  const Boundary = resolveErrorBoundary(modules);
  if (!Boundary) {
    return null;
  }

  const boundaryPayload: RenderPayload = {
    ...payload,
    error: {
      message: error instanceof Error ? error.message : String(error),
    },
  };

  return renderToString(createRouteTree(modules, <Boundary error={error} />, boundaryPayload));
}

export function renderNotFoundApp(modules: RouteModuleBundle, payload: RenderPayload): string | null {
  const Boundary = resolveNotFoundBoundary(modules);
  if (!Boundary) {
    return null;
  }

  return renderToString(createRouteTree(modules, <Boundary />, payload));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toTitleText(children: ReactNode): string {
  return Children.toArray(children)
    .map(child => {
      if (typeof child === "string" || typeof child === "number" || typeof child === "bigint") {
        return String(child);
      }
      if (child === null || child === undefined || typeof child === "boolean") {
        return "";
      }
      // Avoid React <title> array warnings by stringifying non-primitive children.
      return String(child);
    })
    .join("");
}

function normalizeTitleChildren(node: ReactNode): ReactNode {
  if (Array.isArray(node)) {
    return node.map(value => normalizeTitleChildren(value));
  }

  if (!isValidElement(node)) {
    return node;
  }

  if (node.type === "title") {
    return <title>{toTitleText((node.props as { children?: ReactNode }).children)}</title>;
  }

  const props = node.props as { children?: ReactNode };
  if (props.children === undefined) {
    return node;
  }

  const nextChildren = Children.map(props.children, child => normalizeTitleChildren(child));
  return cloneElement(node, undefined, nextChildren);
}

function moduleHeadToString(moduleValue: RouteModule, payload: RenderPayload): string {
  const tags: string[] = [];

  const context = {
    data: payload.data,
    params: payload.params,
    url: new URL(payload.url),
    error: payload.error,
  };

  if (moduleValue.head) {
    const headResult = moduleValue.head(context);
    if (typeof headResult === "string") {
      tags.push(`<title>${escapeHtml(headResult)}</title>`);
    } else if (headResult !== null && headResult !== undefined) {
      tags.push(renderToStaticMarkup(<>{normalizeTitleChildren(headResult)}</>));
    }
  }

  if (moduleValue.meta) {
    const metaResult = typeof moduleValue.meta === "function" ? moduleValue.meta(context) : moduleValue.meta;
    for (const [name, content] of Object.entries(metaResult)) {
      tags.push(`<meta name="${escapeHtml(name)}" content="${escapeHtml(content)}"/>`);
    }
  }

  return tags.join("\n");
}

export function collectHeadMarkup(modules: RouteModuleBundle, payload: RenderPayload): string {
  const parts = [
    moduleHeadToString(modules.root, payload),
    ...modules.layouts.map(layout => moduleHeadToString(layout, payload)),
    moduleHeadToString(modules.route, payload),
  ].filter(Boolean);

  return parts.join("\n");
}

function buildDevReloadScript(version: number): string {
  return `\n<script>\n(() => {\n  const currentVersion = ${version};\n  const source = new EventSource('/__rbssr/events');\n\n  source.addEventListener('reload', event => {\n    const nextVersion = Number(event.data);\n    if (Number.isFinite(nextVersion) && nextVersion > currentVersion) {\n      location.reload();\n    }\n  });\n\n  window.addEventListener('beforeunload', () => {\n    source.close();\n  });\n})();\n</script>`;
}

export function renderDocument(options: {
  appMarkup: string;
  payload: RenderPayload;
  assets: HydrationDocumentAssets;
  headMarkup: string;
}): string {
  const { appMarkup, payload, assets, headMarkup } = options;
  const cssLinks = assets.css
    .map(href => `<link rel="stylesheet" href="${escapeHtml(href)}"/>`)
    .join("\n");

  const payloadScript = `<script id="__RBSSR_PAYLOAD__" type="application/json">${safeJsonSerialize(payload)}</script>`;
  const entryScript = assets.script
    ? `<script type="module" src="${escapeHtml(assets.script)}"></script>`
    : "";
  const devScript = typeof assets.devVersion === "number" ? buildDevReloadScript(assets.devVersion) : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    ${headMarkup}
    ${cssLinks}
  </head>
  <body>
    <div id="rbssr-root">${appMarkup}</div>
    ${payloadScript}
    ${entryScript}
    ${devScript}
  </body>
</html>`;
}
