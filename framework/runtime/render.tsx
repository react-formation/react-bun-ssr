import {
  Children,
  cloneElement,
  isValidElement,
  Suspense,
  use,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToReadableStream, renderToStaticMarkup, renderToString } from "react-dom/server";
import type { DeferredSettleEntry } from "./deferred";
import type {
  ClientRouterSnapshot,
  HydrationDocumentAssets,
  RenderPayload,
  RouteModule,
  RouteModuleBundle,
} from "./types";
import { safeJsonSerialize } from "./utils";
import {
  RBSSR_HEAD_MARKER_END_ATTR,
  RBSSR_HEAD_MARKER_START_ATTR,
  RBSSR_PAYLOAD_SCRIPT_ID,
  RBSSR_ROUTER_SCRIPT_ID,
} from "./runtime-constants";
import {
  createErrorAppTree,
  createNotFoundAppTree,
  createPageAppTree,
} from "./tree";

export function renderPageApp(modules: RouteModuleBundle, payload: RenderPayload): string {
  return renderToString(createPageAppTree(modules, payload));
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
  return `(() => {\n  let currentVersion = ${version};\n  let closed = false;\n  let socket;\n\n  const connect = () => {\n    socket = new WebSocket(\`\${location.protocol === 'https:' ? 'wss' : 'ws'}://\${location.host}/__rbssr/ws\`);\n\n    socket.addEventListener('message', event => {\n      try {\n        const payload = JSON.parse(String(event.data));\n        const nextVersion = Number(payload?.token);\n        if (Number.isFinite(nextVersion) && nextVersion > currentVersion) {\n          currentVersion = nextVersion;\n          location.reload();\n        }\n      } catch {\n        // ignore malformed dev reload payloads\n      }\n    });\n\n    socket.addEventListener('close', () => {\n      if (!closed) {\n        setTimeout(connect, 150);\n      }\n    });\n  };\n\n  connect();\n\n  window.addEventListener('beforeunload', () => {\n    closed = true;\n    socket?.close();\n  });\n})();`;
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

function createVersionedCssHrefs(assets: HydrationDocumentAssets): string[] {
  return assets.css.map(href => withVersionQuery(href, assets.devVersion));
}

interface DocumentRenderState {
  cssHrefs: string[];
  deferredBootstrapScript: string;
  devReloadScript?: string;
  payloadJson: string;
  routerSnapshotJson: string;
  versionedScript?: string;
}

function createDocumentRenderState(options: {
  assets: HydrationDocumentAssets;
  payload: RenderPayload;
  routerSnapshot: ClientRouterSnapshot;
}): DocumentRenderState {
  return {
    cssHrefs: createVersionedCssHrefs(options.assets),
    deferredBootstrapScript: buildDeferredBootstrapScript(),
    devReloadScript: typeof options.assets.devVersion === "number"
      ? buildDevReloadClientScript(options.assets.devVersion)
      : undefined,
    payloadJson: safeJsonSerialize(options.payload),
    routerSnapshotJson: safeJsonSerialize(options.routerSnapshot),
    versionedScript: options.assets.script
      ? withVersionQuery(options.assets.script, options.assets.devVersion)
      : undefined,
  };
}

export function createManagedHeadMarkup(options: {
  headMarkup: string;
  assets: HydrationDocumentAssets;
}): string {
  const cssLinks = createVersionedCssHrefs(options.assets)
    .map(href => `<link rel="stylesheet" href="${Bun.escapeHTML(href)}"/>`)
    .join("");
  return `${options.headMarkup}${cssLinks}`;
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
  managedHeadElements: ReactNode[];
  routerSnapshot: ClientRouterSnapshot;
  deferredSettleEntries: DeferredSettleEntry[];
}): ReactElement {
  const { appTree, managedHeadElements, deferredSettleEntries } = options;
  const documentState = createDocumentRenderState({
    assets: options.assets,
    payload: options.payload,
    routerSnapshot: options.routerSnapshot,
  });
  const cssLinks = documentState.cssHrefs.map((versionedHref, index) => {
    return <link key={`css:${index}:${versionedHref}`} rel="stylesheet" href={versionedHref} />;
  });

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta {...{ [RBSSR_HEAD_MARKER_START_ATTR]: "1" }} />
        {managedHeadElements}
        {cssLinks}
        <meta {...{ [RBSSR_HEAD_MARKER_END_ATTR]: "1" }} />
      </head>
      <body>
        <div id="rbssr-root">{appTree}</div>
        <script
          dangerouslySetInnerHTML={{
            __html: documentState.deferredBootstrapScript,
          }}
        />
        <script
          id={RBSSR_PAYLOAD_SCRIPT_ID}
          type="application/json"
          dangerouslySetInnerHTML={{ __html: documentState.payloadJson }}
        />
        <script
          id={RBSSR_ROUTER_SCRIPT_ID}
          type="application/json"
          dangerouslySetInnerHTML={{ __html: documentState.routerSnapshotJson }}
        />
        {documentState.versionedScript ? <script type="module" src={documentState.versionedScript} /> : null}
        {documentState.devReloadScript ? (
          <script
            dangerouslySetInnerHTML={{
              __html: documentState.devReloadScript,
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
  routerSnapshot: ClientRouterSnapshot;
  deferredSettleEntries?: DeferredSettleEntry[];
}): Promise<ReadableStream<Uint8Array>> {
  const stream = await renderToReadableStream(
    <HtmlDocument
      appTree={options.appTree}
      payload={options.payload}
      assets={options.assets}
      managedHeadElements={options.headElements}
      routerSnapshot={options.routerSnapshot}
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
  routerSnapshot: ClientRouterSnapshot;
}): string {
  const { appMarkup, headMarkup } = options;
  const documentState = createDocumentRenderState({
    assets: options.assets,
    payload: options.payload,
    routerSnapshot: options.routerSnapshot,
  });
  const managedHeadMarkup = createManagedHeadMarkup({
    headMarkup,
    assets: options.assets,
  });

  const payloadScript = `<script id="${RBSSR_PAYLOAD_SCRIPT_ID}" type="application/json">${documentState.payloadJson}</script>`;
  const routerScript = `<script id="${RBSSR_ROUTER_SCRIPT_ID}" type="application/json">${documentState.routerSnapshotJson}</script>`;
  const entryScript = documentState.versionedScript
    ? `<script type="module" src="${Bun.escapeHTML(documentState.versionedScript)}"></script>`
    : "";
  const devScript = documentState.devReloadScript
    ? `<script>${documentState.devReloadScript}</script>`
    : "";
  const deferredBootstrapScript = `<script>${documentState.deferredBootstrapScript}</script>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta ${RBSSR_HEAD_MARKER_START_ATTR}="1" />
    ${managedHeadMarkup}
    <meta ${RBSSR_HEAD_MARKER_END_ATTR}="1" />
  </head>
  <body>
    <div id="rbssr-root">${appMarkup}</div>
    ${deferredBootstrapScript}
    ${payloadScript}
    ${routerScript}
    ${entryScript}
    ${devScript}
  </body>
</html>`;
}
