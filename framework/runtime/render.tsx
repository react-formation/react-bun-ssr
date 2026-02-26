import {
  Children,
  cloneElement,
  isValidElement,
  Suspense,
  use,
  type ComponentType,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToReadableStream, renderToStaticMarkup, renderToString } from "react-dom/server";
import type { DeferredSettleEntry } from "./deferred";
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
  const tree = createErrorAppTree(modules, payload, error);
  return tree ? renderToString(tree) : null;
}

export function renderNotFoundApp(modules: RouteModuleBundle, payload: RenderPayload): string | null {
  const tree = createNotFoundAppTree(modules, payload);
  return tree ? renderToString(tree) : null;
}

export function createPageAppTree(modules: RouteModuleBundle, payload: RenderPayload): ReactElement {
  const Leaf = modules.route.default;
  return createRouteTree(modules, <Leaf />, payload);
}

export function createErrorAppTree(
  modules: RouteModuleBundle,
  payload: RenderPayload,
  error: unknown,
): ReactElement | null {
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

  return createRouteTree(modules, <Boundary error={error} />, boundaryPayload);
}

export function createNotFoundAppTree(modules: RouteModuleBundle, payload: RenderPayload): ReactElement | null {
  const Boundary = resolveNotFoundBoundary(modules);
  if (!Boundary) {
    return null;
  }

  return createRouteTree(modules, <Boundary />, payload);
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

function moduleHeadToElements(moduleValue: RouteModule, payload: RenderPayload, keyPrefix: string): ReactNode[] {
  const tags: ReactNode[] = [];

  const context = {
    data: payload.data,
    params: payload.params,
    url: new URL(payload.url),
    error: payload.error,
  };

  if (moduleValue.head) {
    const headResult = moduleValue.head(context);
    if (typeof headResult === "string") {
      tags.push(<title key={`${keyPrefix}:title`}>{headResult}</title>);
    } else if (headResult !== null && headResult !== undefined) {
      const nodes = Children.toArray(normalizeTitleChildren(headResult));
      for (let index = 0; index < nodes.length; index += 1) {
        const node = nodes[index]!;
        if (isValidElement(node)) {
          tags.push(cloneElement(node, { key: `${keyPrefix}:head:${index}` }));
        } else {
          tags.push(node);
        }
      }
    }
  }

  if (moduleValue.meta) {
    const metaResult = typeof moduleValue.meta === "function" ? moduleValue.meta(context) : moduleValue.meta;
    for (const [name, content] of Object.entries(metaResult)) {
      tags.push(<meta key={`${keyPrefix}:meta:${name}`} name={name} content={content} />);
    }
  }

  return tags;
}

export function collectHeadElements(modules: RouteModuleBundle, payload: RenderPayload): ReactNode[] {
  return [
    ...moduleHeadToElements(modules.root, payload, "root"),
    ...modules.layouts.flatMap((layout, index) => moduleHeadToElements(layout, payload, `layout:${index}`)),
    ...moduleHeadToElements(modules.route, payload, "route"),
  ];
}

export function collectHeadMarkup(modules: RouteModuleBundle, payload: RenderPayload): string {
  const elements = collectHeadElements(modules, payload);
  return renderToStaticMarkup(<>{elements}</>);
}

function buildDevReloadClientScript(version: number): string {
  return `(() => {\n  const currentVersion = ${version};\n  const source = new EventSource('/__rbssr/events');\n\n  source.addEventListener('reload', event => {\n    const nextVersion = Number(event.data);\n    if (Number.isFinite(nextVersion) && nextVersion > currentVersion) {\n      location.reload();\n    }\n  });\n\n  window.addEventListener('beforeunload', () => {\n    source.close();\n  });\n})();`;
}

function buildDeferredBootstrapScript(): string {
  return `(() => {\n  if (window.__RBSSR_DEFERRED__) {\n    return;\n  }\n\n  const entries = new Map();\n\n  const ensure = (id) => {\n    const existing = entries.get(id);\n    if (existing) {\n      return existing;\n    }\n\n    let resolve;\n    let reject;\n    const promise = new Promise((res, rej) => {\n      resolve = res;\n      reject = rej;\n    });\n\n    const created = {\n      status: 'pending',\n      promise,\n      resolve,\n      reject,\n    };\n\n    entries.set(id, created);\n    return created;\n  };\n\n  window.__RBSSR_DEFERRED__ = {\n    get(id) {\n      return ensure(id).promise;\n    },\n    resolve(id, value) {\n      const entry = ensure(id);\n      if (entry.status !== 'pending') {\n        return;\n      }\n      entry.status = 'fulfilled';\n      entry.resolve(value);\n    },\n    reject(id, message) {\n      const entry = ensure(id);\n      if (entry.status !== 'pending') {\n        return;\n      }\n      entry.status = 'rejected';\n      entry.reject(new Error(String(message)));\n    },\n  };\n})();`;
}

function withVersionQuery(url: string, version?: number): string {
  if (typeof version !== "number") {
    return url;
  }
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${version}`;
}

function toDeferredScript(entry: DeferredSettleEntry): ReactElement {
  return (
    <Suspense fallback={null} key={entry.id}>
      <DeferredScriptItem entry={entry} />
    </Suspense>
  );
}

function DeferredScriptItem(options: { entry: DeferredSettleEntry }): ReactElement {
  const settled = use(options.entry.settled);
  const serializedId = safeJsonSerialize(options.entry.id);
  const code = settled.ok
    ? `window.__RBSSR_DEFERRED__.resolve(${serializedId}, ${safeJsonSerialize(settled.value)});`
    : `window.__RBSSR_DEFERRED__.reject(${serializedId}, ${safeJsonSerialize(settled.error)});`;

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

function HtmlDocument(options: {
  appTree: ReactElement;
  payload: RenderPayload;
  assets: HydrationDocumentAssets;
  headElements: ReactNode[];
  deferredSettleEntries: DeferredSettleEntry[];
}): ReactElement {
  const { appTree, payload, assets, headElements, deferredSettleEntries } = options;
  const versionedScript = assets.script ? withVersionQuery(assets.script, assets.devVersion) : undefined;
  const cssLinks = assets.css.map((href, index) => {
    const versionedHref = withVersionQuery(href, assets.devVersion);
    return <link key={`css:${index}:${versionedHref}`} rel="stylesheet" href={versionedHref} />;
  });

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {headElements}
        {cssLinks}
      </head>
      <body>
        <div id="rbssr-root">{appTree}</div>
        <script
          dangerouslySetInnerHTML={{
            __html: buildDeferredBootstrapScript(),
          }}
        />
        <script
          id="__RBSSR_PAYLOAD__"
          type="application/json"
          dangerouslySetInnerHTML={{ __html: safeJsonSerialize(payload) }}
        />
        {versionedScript ? <script type="module" src={versionedScript} /> : null}
        {typeof assets.devVersion === "number" ? (
          <script
            dangerouslySetInnerHTML={{
              __html: buildDevReloadClientScript(assets.devVersion),
            }}
          />
        ) : null}
        {deferredSettleEntries.map(toDeferredScript)}
      </body>
    </html>
  );
}

function prependDoctype(stream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const doctype = encoder.encode("<!doctype html>");

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(doctype);
      const reader = stream.getReader();

      try {
        while (true) {
          const result = await reader.read();
          if (result.done) {
            break;
          }
          controller.enqueue(result.value);
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
    cancel(reason) {
      void stream.cancel(reason);
    },
  });
}

export async function renderDocumentStream(options: {
  appTree: ReactElement;
  payload: RenderPayload;
  assets: HydrationDocumentAssets;
  headElements: ReactNode[];
  deferredSettleEntries?: DeferredSettleEntry[];
}): Promise<ReadableStream<Uint8Array>> {
  const stream = await renderToReadableStream(
    <HtmlDocument
      appTree={options.appTree}
      payload={options.payload}
      assets={options.assets}
      headElements={options.headElements}
      deferredSettleEntries={options.deferredSettleEntries ?? []}
    />,
  );

  return prependDoctype(stream);
}

export function renderDocument(options: {
  appMarkup: string;
  payload: RenderPayload;
  assets: HydrationDocumentAssets;
  headMarkup: string;
}): string {
  const { appMarkup, payload, assets, headMarkup } = options;
  const versionedScript = assets.script ? withVersionQuery(assets.script, assets.devVersion) : undefined;
  const cssLinks = assets.css
    .map(href => `<link rel="stylesheet" href="${escapeHtml(withVersionQuery(href, assets.devVersion))}"/>`)
    .join("\n");

  const payloadScript = `<script id="__RBSSR_PAYLOAD__" type="application/json">${safeJsonSerialize(payload)}</script>`;
  const entryScript = versionedScript
    ? `<script type="module" src="${escapeHtml(versionedScript)}"></script>`
    : "";
  const devScript = typeof assets.devVersion === "number"
    ? `<script>${buildDevReloadClientScript(assets.devVersion)}</script>`
    : "";
  const deferredBootstrapScript = `<script>${buildDeferredBootstrapScript()}</script>`;

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
    ${deferredBootstrapScript}
    ${payloadScript}
    ${entryScript}
    ${devScript}
  </body>
</html>`;
}
