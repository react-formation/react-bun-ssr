import { hydrateRoot, type Root } from "react-dom/client";
import {
  consumeTransitionChunkText,
  createTransitionChunkParserState,
  flushTransitionChunkText,
  isStaleNavigationToken,
  matchClientPageRoute,
  sanitizePrefetchCache,
  shouldHardNavigateForRedirectDepth,
  shouldSkipSoftNavigation,
} from "./client-transition-core";
import { isDeferredToken } from "./deferred";
import {
  addNavigationNavigateListener,
  canNavigationNavigateWithIntercept,
  dispatchNavigationNavigate,
  type NavigationHistoryMode,
} from "./navigation-api";
import {
  RBSSR_HEAD_MARKER_END_ATTR,
  RBSSR_HEAD_MARKER_START_ATTR,
  RBSSR_PAYLOAD_SCRIPT_ID,
  RBSSR_ROUTER_SCRIPT_ID,
} from "./runtime-constants";
import {
  createCatchAppTree,
  createErrorAppTree,
  createLoadingAppTree,
  createNotFoundAppTree,
  createPageAppTree,
} from "./tree";
import { isRouteErrorResponse } from "./route-errors";
import type {
  ClientRouterSnapshot,
  RenderPayload,
  RouteModule,
  RouteModuleBundle,
  TransitionDeferredChunk,
  TransitionDocumentChunk,
  TransitionInitialChunk,
  TransitionRedirectChunk,
} from "./types";

interface DeferredClientRuntime {
  get(id: string): Promise<unknown>;
  resolve(id: string, value: unknown): void;
  reject(id: string, message: string): void;
}

interface NavigateOptions {
  replace?: boolean;
  scroll?: boolean;
  onNavigate?: (info: NavigateResult) => void;
  isPopState?: boolean;
  historyManagedByNavigationApi?: boolean;
  redirected?: boolean;
  redirectDepth?: number;
}

interface NavigateResult {
  from: string;
  to: string;
  status: number;
  kind: "page" | "not_found" | "catch" | "error";
  redirected: boolean;
  prefetched: boolean;
}

interface PrefetchEntry {
  createdAt: number;
  modulePromise: Promise<void>;
  initialPromise: Promise<TransitionInitialChunk | TransitionRedirectChunk | TransitionDocumentChunk | null>;
  donePromise: Promise<void>;
}

interface TransitionRequestOptions {
  onDeferredChunk?: (chunk: TransitionDeferredChunk) => void;
  signal?: AbortSignal;
}

interface TransitionRequestHandle {
  initialPromise: Promise<TransitionInitialChunk | TransitionRedirectChunk | TransitionDocumentChunk | null>;
  donePromise: Promise<void>;
}

interface FrameworkNavigationInfo {
  __rbssrTransition: true;
  id: string;
}

interface NavigationDestinationLike {
  url?: string | URL;
}

interface NavigationInterceptOptionsLike {
  handler?: () => void | Promise<void>;
}

interface NavigateEventLike {
  info?: unknown;
  canIntercept?: boolean;
  userInitiated?: boolean;
  destination?: NavigationDestinationLike;
  intercept?: (options: NavigationInterceptOptionsLike) => void;
}

interface PendingNavigationTransition {
  id: string;
  destinationHref: string;
  replace: boolean;
  scroll: boolean;
  onNavigate?: (info: NavigateResult) => void;
  createdAt: number;
  resolve: (value: NavigateResult | null) => void;
  settled: boolean;
  timeoutId: number;
}

interface RuntimeState {
  root: Root;
  currentPayload: RenderPayload;
  currentRouteId: string;
  currentModules: RouteModuleBundle;
  routerSnapshot: ClientRouterSnapshot;
  moduleRegistry: Map<string, RouteModuleBundle>;
  prefetchCache: Map<string, PrefetchEntry>;
  navigationToken: number;
  transitionAbortController: AbortController | null;
}

declare global {
  interface Window {
    __RBSSR_DEFERRED__?: DeferredClientRuntime;
  }
}

const NAVIGATION_API_PENDING_TIMEOUT_MS = 1_500;
const NAVIGATION_API_PENDING_MATCH_WINDOW_MS = 10_000;
const ROUTE_ANNOUNCER_ID = "__rbssr-route-announcer";
const moduleRegistry = new Map<string, RouteModuleBundle>();
const pendingNavigationTransitions = new Map<string, PendingNavigationTransition>();
let runtimeState: RuntimeState | null = null;
let popstateBound = false;
let navigationApiListenerBound = false;
let navigationApiTransitionCounter = 0;

function withVersionQuery(url: string, version?: number): string {
  if (typeof version !== "number") {
    return url;
  }
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${version}`;
}

function getScriptJson<T>(id: string): T {
  const script = document.getElementById(id);
  if (!script) {
    throw new Error(`Missing script tag #${id}`);
  }

  const raw = script.textContent ?? "{}";
  return JSON.parse(raw) as T;
}

function ensureRouteAnnouncer(): HTMLDivElement | null {
  if (typeof document === "undefined") {
    return null;
  }

  const existing = document.getElementById(ROUTE_ANNOUNCER_ID);
  if (existing instanceof HTMLDivElement) {
    return existing;
  }

  const announcer = document.createElement("div");
  announcer.id = ROUTE_ANNOUNCER_ID;
  announcer.setAttribute("aria-live", "assertive");
  announcer.setAttribute("aria-atomic", "true");
  announcer.style.position = "absolute";
  announcer.style.width = "1px";
  announcer.style.height = "1px";
  announcer.style.padding = "0";
  announcer.style.margin = "-1px";
  announcer.style.overflow = "hidden";
  announcer.style.clip = "rect(0, 0, 0, 0)";
  announcer.style.whiteSpace = "nowrap";
  announcer.style.border = "0";

  document.body.appendChild(announcer);
  return announcer;
}

function getRouteAnnouncementText(): string {
  const title = document.title.trim();
  const heading = document.querySelector("h1");
  const headingText = heading?.textContent?.trim() ?? "";

  if (title.length > 0) {
    if (headingText.length === 0) {
      return title;
    }

    const normalizedTitle = title.toLowerCase();
    const normalizedHeading = headingText.toLowerCase();
    if (
      normalizedTitle.includes(normalizedHeading)
      || normalizedHeading.includes(normalizedTitle)
    ) {
      return title;
    }
  }

  if (headingText.length > 0) {
    return headingText;
  }

  if (title.length > 0) {
    return title;
  }

  return window.location.pathname || "/";
}

function announceRouteChange(): void {
  const announcer = ensureRouteAnnouncer();
  if (!announcer) {
    return;
  }

  window.requestAnimationFrame(() => {
    window.setTimeout(() => {
      const announcement = getRouteAnnouncementText();
      announcer.textContent = "";
      window.setTimeout(() => {
        announcer.textContent = announcement;
      }, 0);
    }, 50);
  });
}

function isFrameworkNavigationInfo(value: unknown): value is FrameworkNavigationInfo {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as {
    __rbssrTransition?: unknown;
    id?: unknown;
  };

  return candidate.__rbssrTransition === true && typeof candidate.id === "string";
}

function toAbsoluteNavigationHref(href: string): string {
  return new URL(href, window.location.href).toString();
}

function readNavigationDestinationHref(event: NavigateEventLike): string | null {
  const rawUrl = event.destination?.url;
  if (typeof rawUrl === "string") {
    return toAbsoluteNavigationHref(rawUrl);
  }

  if (rawUrl instanceof URL) {
    return rawUrl.toString();
  }

  return null;
}

function clearPendingNavigationTransition(id: string): void {
  const entry = pendingNavigationTransitions.get(id);
  if (!entry) {
    return;
  }

  clearTimeout(entry.timeoutId);
  pendingNavigationTransitions.delete(id);
}

function findPendingTransitionForEvent(event: NavigateEventLike): PendingNavigationTransition | null {
  if (isFrameworkNavigationInfo(event.info)) {
    return pendingNavigationTransitions.get(event.info.id) ?? null;
  }

  if (event.userInitiated) {
    return null;
  }

  const destinationHref = readNavigationDestinationHref(event);
  if (!destinationHref) {
    return null;
  }

  const now = Date.now();
  let bestMatch: PendingNavigationTransition | null = null;
  for (const candidate of pendingNavigationTransitions.values()) {
    if (candidate.destinationHref !== destinationHref) {
      continue;
    }

    if (now - candidate.createdAt > NAVIGATION_API_PENDING_MATCH_WINDOW_MS) {
      continue;
    }

    if (!bestMatch || candidate.createdAt > bestMatch.createdAt) {
      bestMatch = candidate;
    }
  }

  return bestMatch;
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

function ensureRuntimeState(): RuntimeState {
  if (!runtimeState) {
    throw new Error("Client runtime is not initialized. Ensure hydrateInitialRoute() ran first.");
  }

  return runtimeState;
}

function createTransitionUrl(toUrl: URL): URL {
  const transitionUrl = new URL("/__rbssr/transition", window.location.origin);
  transitionUrl.searchParams.set("to", toUrl.pathname + toUrl.search + toUrl.hash);
  return transitionUrl;
}

function startTransitionRequest(
  toUrl: URL,
  options: TransitionRequestOptions = {},
): TransitionRequestHandle {
  let resolveInitial: (
    value: TransitionInitialChunk | TransitionRedirectChunk | TransitionDocumentChunk | null,
  ) => void = () => undefined;
  let rejectInitial: (reason?: unknown) => void = () => undefined;
  const initialPromise = new Promise<
    TransitionInitialChunk | TransitionRedirectChunk | TransitionDocumentChunk | null
  >((resolve, reject) => {
    resolveInitial = resolve;
    rejectInitial = reject;
  });

  const donePromise = (async () => {
    const endpoint = createTransitionUrl(toUrl);
    const response = await fetch(endpoint.toString(), {
      method: "GET",
      credentials: "same-origin",
      signal: options.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`Transition request failed with status ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let parserState = createTransitionChunkParserState();

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      const previousInitialChunk = parserState.initialChunk;
      const previousDeferredCount = parserState.deferredChunks.length;
      parserState = consumeTransitionChunkText(
        parserState,
        decoder.decode(value, { stream: true }),
      );

      if (!previousInitialChunk && parserState.initialChunk) {
        resolveInitial(parserState.initialChunk);
      }

      for (const chunk of parserState.deferredChunks.slice(previousDeferredCount)) {
        options.onDeferredChunk?.(chunk);
      }
    }

    const previousInitialChunk = parserState.initialChunk;
    const previousDeferredCount = parserState.deferredChunks.length;
    parserState = flushTransitionChunkText(parserState);

    if (!previousInitialChunk && parserState.initialChunk) {
      resolveInitial(parserState.initialChunk);
    }

    for (const chunk of parserState.deferredChunks.slice(previousDeferredCount)) {
      options.onDeferredChunk?.(chunk);
    }

    if (!parserState.initialChunk) {
      resolveInitial(null);
    }
  })();

  donePromise.catch(error => {
    rejectInitial(error);
  });

  return {
    initialPromise,
    donePromise,
  };
}

function applyDeferredChunk(chunk: TransitionDeferredChunk): void {
  const runtime = window.__RBSSR_DEFERRED__;
  if (!runtime) {
    return;
  }

  if (chunk.ok) {
    runtime.resolve(chunk.id, chunk.value);
    return;
  }

  runtime.reject(chunk.id, chunk.error ?? "Deferred value rejected");
}

async function ensureRouteModuleLoaded(routeId: string, snapshot: ClientRouterSnapshot): Promise<void> {
  if (moduleRegistry.has(routeId)) {
    return;
  }

  const asset = snapshot.assets[routeId];
  if (!asset?.script) {
    throw new Error(`Missing client asset script for route "${routeId}"`);
  }

  const scriptUrl = withVersionQuery(asset.script, snapshot.devVersion);
  await import(scriptUrl);
}

function getOrCreatePrefetchEntry(
  toUrl: URL,
  routeId: string | null,
  snapshot: ClientRouterSnapshot,
  signal?: AbortSignal,
): PrefetchEntry {
  const state = ensureRuntimeState();
  sanitizePrefetchCache(state.prefetchCache);
  const cacheKey = toUrl.pathname + toUrl.search + toUrl.hash;
  const existing = state.prefetchCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const modulePromise = routeId
    ? ensureRouteModuleLoaded(routeId, snapshot).catch(() => undefined)
    : Promise.resolve();

  const transitionRequest = startTransitionRequest(toUrl, {
    onDeferredChunk: applyDeferredChunk,
    signal,
  });
  const initialPromise = transitionRequest.initialPromise.catch(() => {
    state.prefetchCache.delete(cacheKey);
    return null;
  });
  const donePromise = transitionRequest.donePromise.catch(() => {
    state.prefetchCache.delete(cacheKey);
  });

  const entry: PrefetchEntry = {
    createdAt: Date.now(),
    modulePromise,
    initialPromise,
    donePromise,
  };

  state.prefetchCache.set(cacheKey, entry);
  return entry;
}

function createFallbackNotFoundRoute(rootModule: RouteModule): RouteModule {
  return {
    default: () => null,
    NotFound: rootModule.NotFound,
  };
}

function nodeSignature(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return `text:${node.textContent ?? ""}`;
  }

  if (node.nodeType === Node.COMMENT_NODE) {
    return `comment:${node.textContent ?? ""}`;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return `node:${node.nodeType}`;
  }

  const element = node as Element;
  const attrs = Array.from(element.attributes)
    .map(attribute => `${attribute.name}=${attribute.value}`)
    .sort((a, b) => a.localeCompare(b))
    .join("|");

  return `element:${element.tagName.toLowerCase()}:${attrs}:${element.innerHTML}`;
}

function isIgnorableTextNode(node: Node): boolean {
  return node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim().length === 0;
}

function getManagedHeadNodes(startMarker: Element, endMarker: Element): Node[] {
  const nodes: Node[] = [];
  let cursor = startMarker.nextSibling;
  while (cursor && cursor !== endMarker) {
    nodes.push(cursor);
    cursor = cursor.nextSibling;
  }
  return nodes;
}

function removeNode(node: Node): void {
  if (node.parentNode) {
    node.parentNode.removeChild(node);
  }
}

function isStylesheetLinkNode(node: Node): node is HTMLLinkElement {
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }

  const element = node as Element;
  return (
    element.tagName.toLowerCase() === "link"
    && (element.getAttribute("rel")?.toLowerCase() ?? "") === "stylesheet"
    && Boolean(element.getAttribute("href"))
  );
}

function toAbsoluteHref(href: string): string {
  return new URL(href, document.baseURI).toString();
}

function waitForStylesheetLoad(link: HTMLLinkElement): Promise<void> {
  const sheet = link.sheet;
  if (sheet) {
    return Promise.resolve();
  }

  return new Promise(resolve => {
    const finish = () => {
      link.removeEventListener("load", finish);
      link.removeEventListener("error", finish);
      resolve();
    };

    link.addEventListener("load", finish, { once: true });
    link.addEventListener("error", finish, { once: true });
  });
}

async function reconcileStylesheetLinks(options: {
  head: HTMLHeadElement;
  desiredStylesheetHrefs: string[];
}): Promise<void> {
  const desiredAbsoluteHrefs = options.desiredStylesheetHrefs.map(toAbsoluteHref);
  const existingLinks = Array.from(
    options.head.querySelectorAll('link[rel="stylesheet"][href]'),
  ) as HTMLLinkElement[];

  const existingByAbsoluteHref = new Map<string, HTMLLinkElement[]>();
  for (const link of existingLinks) {
    const href = link.getAttribute("href");
    if (!href) {
      continue;
    }
    const absoluteHref = toAbsoluteHref(href);
    const list = existingByAbsoluteHref.get(absoluteHref) ?? [];
    list.push(link);
    existingByAbsoluteHref.set(absoluteHref, list);
  }

  const waitForLoads: Promise<void>[] = [];
  for (let index = 0; index < options.desiredStylesheetHrefs.length; index += 1) {
    const href = options.desiredStylesheetHrefs[index]!;
    const absoluteHref = desiredAbsoluteHrefs[index]!;
    const existing = existingByAbsoluteHref.get(absoluteHref)?.[0];
    if (existing) {
      waitForLoads.push(waitForStylesheetLoad(existing));
      continue;
    }

    const link = document.createElement("link");
    link.setAttribute("rel", "stylesheet");
    link.setAttribute("href", href);
    options.head.appendChild(link);
    waitForLoads.push(waitForStylesheetLoad(link));
  }

  const seen = new Set<string>();
  for (const link of Array.from(options.head.querySelectorAll('link[rel="stylesheet"][href]'))) {
    const href = link.getAttribute("href");
    if (!href) {
      continue;
    }

    const absoluteHref = toAbsoluteHref(href);
    if (seen.has(absoluteHref)) {
      removeNode(link);
      continue;
    }

    seen.add(absoluteHref);
  }

  await Promise.all(waitForLoads);
}

async function replaceManagedHead(headHtml: string): Promise<void> {
  const head = document.head;
  const startMarker = head.querySelector(`meta[${RBSSR_HEAD_MARKER_START_ATTR}]`);
  const endMarker = head.querySelector(`meta[${RBSSR_HEAD_MARKER_END_ATTR}]`);

  if (!startMarker || !endMarker || startMarker === endMarker) {
    return;
  }

  const template = document.createElement("template");
  template.innerHTML = headHtml;

  const desiredStylesheetHrefs = Array.from(template.content.querySelectorAll('link[rel="stylesheet"][href]'))
    .map(link => link.getAttribute("href"))
    .filter((value): value is string => Boolean(value));
  for (const styleNode of Array.from(template.content.querySelectorAll('link[rel="stylesheet"][href]'))) {
    removeNode(styleNode);
  }

  const desiredNodes = Array.from(template.content.childNodes).filter(node => !isIgnorableTextNode(node));
  const currentNodes = getManagedHeadNodes(startMarker, endMarker).filter(node => {
    if (isIgnorableTextNode(node)) {
      return false;
    }

    if (isStylesheetLinkNode(node)) {
      return false;
    }

    return true;
  });
  const unusedCurrentNodes = new Set(currentNodes);

  let cursor = startMarker.nextSibling;

  for (const desiredNode of desiredNodes) {
    while (cursor && cursor !== endMarker && isIgnorableTextNode(cursor)) {
      const next = cursor.nextSibling;
      removeNode(cursor);
      cursor = next;
    }

    const desiredSignature = nodeSignature(desiredNode);

    if (cursor && cursor !== endMarker && nodeSignature(cursor) === desiredSignature) {
      unusedCurrentNodes.delete(cursor);
      cursor = cursor.nextSibling;
      continue;
    }

    let matchedNode: Node | null = null;
    for (const currentNode of currentNodes) {
      if (!unusedCurrentNodes.has(currentNode)) {
        continue;
      }
      if (nodeSignature(currentNode) === desiredSignature) {
        matchedNode = currentNode;
        break;
      }
    }

    if (matchedNode) {
      unusedCurrentNodes.delete(matchedNode);
      head.insertBefore(matchedNode, cursor ?? endMarker);
      continue;
    }

    head.insertBefore(desiredNode.cloneNode(true), cursor ?? endMarker);
  }

  for (const leftover of unusedCurrentNodes) {
    removeNode(leftover);
  }

  await reconcileStylesheetLinks({
    head,
    desiredStylesheetHrefs,
  });
}

async function renderTransitionInitial(
  chunk: TransitionInitialChunk,
  toUrl: URL,
  options: NavigateOptions & { prefetched: boolean; fromPath: string },
): Promise<NavigateResult> {
  const state = ensureRuntimeState();
  const revivedPayload = reviveDeferredPayload(chunk.payload);
  let modules: RouteModuleBundle | null = null;
  let tree = null as ReturnType<typeof createPageAppTree> | ReturnType<typeof createNotFoundAppTree>;

  if (chunk.kind === "not_found") {
    modules = {
      root: state.currentModules.root,
      layouts: [],
      route: createFallbackNotFoundRoute(state.currentModules.root),
    };
    tree = createNotFoundAppTree(modules, revivedPayload);
  } else {
    modules = state.moduleRegistry.get(revivedPayload.routeId) ?? null;
    if (!modules) {
      throw new Error(`Missing loaded module bundle for route "${revivedPayload.routeId}"`);
    }

    if (chunk.kind === "error") {
      tree = createErrorAppTree(
        modules,
        revivedPayload,
        new Error(messageFromPayloadError(revivedPayload.error)),
      );
    } else if (chunk.kind === "catch") {
      if (!isRouteErrorResponse(revivedPayload.error)) {
        throw new Error("Transition catch payload is missing a valid route error.");
      }

      tree = createCatchAppTree(modules, revivedPayload, revivedPayload.error);
    } else {
      tree = createPageAppTree(modules, revivedPayload);
    }
  }

  if (!tree || !modules) {
    throw new Error("Failed to build app tree for transition render.");
  }

  await replaceManagedHead(chunk.head);
  state.root.render(tree);
  announceRouteChange();

  if (!options.isPopState && !options.historyManagedByNavigationApi) {
    const nextUrl = toUrl.pathname + toUrl.search + toUrl.hash;
    if (options.replace || options.redirected) {
      window.history.replaceState(null, "", nextUrl);
    } else {
      window.history.pushState(null, "", nextUrl);
    }
  }

  if (!options.isPopState && options.scroll !== false) {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  state.currentPayload = revivedPayload;
  state.currentRouteId = revivedPayload.routeId;
  state.currentModules = modules;

  return {
    from: options.fromPath,
    to: toUrl.pathname + toUrl.search + toUrl.hash,
    status: chunk.status,
    kind: chunk.kind,
    redirected: options.redirected ?? false,
    prefetched: options.prefetched,
  };
}

function isInternalUrl(url: URL): boolean {
  return url.origin === window.location.origin;
}

function hardNavigate(url: URL): void {
  window.location.assign(url.toString());
}

function messageFromPayloadError(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (!value || typeof value !== "object") {
    return "Route render error";
  }

  const candidate = value as { message?: unknown };
  if (typeof candidate.message === "string" && candidate.message.trim().length > 0) {
    return candidate.message;
  }

  return "Route render error";
}

async function navigateToInternal(
  toUrl: URL,
  options: NavigateOptions = {},
): Promise<NavigateResult | null> {
  const state = ensureRuntimeState();
  const currentPath = window.location.pathname + window.location.search + window.location.hash;
  const targetPath = toUrl.pathname + toUrl.search + toUrl.hash;

  if (shouldSkipSoftNavigation(currentPath, targetPath, options)) {
    return null;
  }

  const matched = matchClientPageRoute(state.routerSnapshot.pages, toUrl.pathname);
  const routeId = matched?.route.id ?? null;

  if (state.transitionAbortController) {
    state.transitionAbortController.abort();
  }

  const abortController = new AbortController();
  state.transitionAbortController = abortController;

  sanitizePrefetchCache(state.prefetchCache);
  const prefetchKey = toUrl.pathname + toUrl.search + toUrl.hash;
  const existingPrefetch = state.prefetchCache.get(prefetchKey);
  const prefetchEntry = existingPrefetch
    ?? getOrCreatePrefetchEntry(toUrl, routeId, state.routerSnapshot, abortController.signal);
  const usedPrefetch = Boolean(existingPrefetch);
  state.navigationToken += 1;
  const navigationToken = state.navigationToken;

  try {
    await prefetchEntry.modulePromise;
    if (isStaleNavigationToken(state.navigationToken, navigationToken)) {
      return null;
    }

    if (matched) {
      const matchedModules = state.moduleRegistry.get(matched.route.id);
      if (matchedModules) {
        const loadingTree = createLoadingAppTree(
          matchedModules,
          {
            routeId: matched.route.id,
            data: null,
            params: matched.params,
            url: toUrl.toString(),
          },
        );
        if (loadingTree) {
          state.root.render(loadingTree);
        }
      }
    }

    const initialChunk = await prefetchEntry.initialPromise;
    if (isStaleNavigationToken(state.navigationToken, navigationToken)) {
      return null;
    }

    if (!initialChunk) {
      throw new Error("Transition response did not include an initial payload.");
    }

    if (initialChunk.type === "document") {
      hardNavigate(new URL(initialChunk.location, window.location.origin));
      return null;
    }

    if (initialChunk.type === "redirect") {
      const redirectUrl = new URL(initialChunk.location, window.location.origin);
      if (!isInternalUrl(redirectUrl)) {
        hardNavigate(redirectUrl);
        return null;
      }

      const depth = (options.redirectDepth ?? 0) + 1;
      if (shouldHardNavigateForRedirectDepth(depth)) {
        hardNavigate(redirectUrl);
        return null;
      }

      return navigateToInternal(redirectUrl, {
        ...options,
        replace: true,
        redirected: true,
        redirectDepth: depth,
        // The intercepted navigation has already committed the source URL.
        // The redirected target must update history explicitly.
        historyManagedByNavigationApi: false,
      });
    }

    const result = await renderTransitionInitial(initialChunk, toUrl, {
      ...options,
      prefetched: usedPrefetch,
      fromPath: currentPath,
    });
    options.onNavigate?.(result);
    return result;
  } catch {
    hardNavigate(toUrl);
    return null;
  } finally {
    if (state.transitionAbortController === abortController) {
      state.transitionAbortController = null;
    }
  }
}

function nextNavigationTransitionId(): string {
  navigationApiTransitionCounter += 1;
  return `rbssr-nav-${Date.now()}-${navigationApiTransitionCounter}`;
}

function settlePendingNavigationTransition(
  transition: PendingNavigationTransition,
  result: NavigateResult | null,
): void {
  if (transition.settled) {
    return;
  }

  transition.settled = true;
  clearPendingNavigationTransition(transition.id);
  transition.resolve(result);
}

function cancelPendingNavigationTransition(id: string): void {
  const pending = pendingNavigationTransitions.get(id);
  if (!pending || pending.settled) {
    return;
  }

  pending.settled = true;
  clearPendingNavigationTransition(id);
  pending.resolve(null);
}

function fallbackPendingNavigationTransition(pending: PendingNavigationTransition): void {
  if (pending.settled) {
    return;
  }

  pending.settled = true;
  clearPendingNavigationTransition(pending.id);
  const destinationUrl = new URL(pending.destinationHref, window.location.href);
  void navigateToInternal(destinationUrl, {
    replace: pending.replace,
    scroll: pending.scroll,
    onNavigate: pending.onNavigate,
  }).then(result => {
    pending.resolve(result);
  });
}

function createPendingNavigationTransition(options: {
  id: string;
  toUrl: URL;
  replace: boolean;
  scroll: boolean;
  onNavigate?: (info: NavigateResult) => void;
}): Promise<NavigateResult | null> {
  return new Promise(resolve => {
    const timeoutId = window.setTimeout(() => {
      const pending = pendingNavigationTransitions.get(options.id);
      if (!pending || pending.settled) {
        return;
      }

      pending.settled = true;
      clearPendingNavigationTransition(options.id);
      void navigateToInternal(options.toUrl, {
        replace: options.replace,
        scroll: options.scroll,
        onNavigate: options.onNavigate,
      }).then(result => {
        resolve(result);
      });
    }, NAVIGATION_API_PENDING_TIMEOUT_MS);

    pendingNavigationTransitions.set(options.id, {
      id: options.id,
      destinationHref: options.toUrl.toString(),
      replace: options.replace,
      scroll: options.scroll,
      onNavigate: options.onNavigate,
      createdAt: Date.now(),
      resolve,
      settled: false,
      timeoutId,
    });
  });
}

function bindNavigationApiNavigateListener(): void {
  if (navigationApiListenerBound || typeof window === "undefined") {
    return;
  }

  if (!canNavigationNavigateWithIntercept()) {
    return;
  }

  const unsubscribe = addNavigationNavigateListener(rawEvent => {
    const navigateEvent = rawEvent as NavigateEventLike;
    if (typeof navigateEvent?.intercept !== "function") {
      return;
    }

    if (navigateEvent.canIntercept === false) {
      return;
    }

    const pending = findPendingTransitionForEvent(navigateEvent);
    if (!pending) {
      return;
    }

    const destinationHref = readNavigationDestinationHref(navigateEvent);
    if (!destinationHref) {
      fallbackPendingNavigationTransition(pending);
      return;
    }

    const destinationUrl = new URL(destinationHref, window.location.href);
    if (!isInternalUrl(destinationUrl)) {
      fallbackPendingNavigationTransition(pending);
      return;
    }

    try {
      navigateEvent.intercept({
        handler: async () => {
          try {
            const result = await navigateToInternal(destinationUrl, {
              replace: pending.replace,
              scroll: pending.scroll,
              onNavigate: pending.onNavigate,
              historyManagedByNavigationApi: true,
            });
            settlePendingNavigationTransition(pending, result);
          } catch {
            settlePendingNavigationTransition(pending, null);
          }
        },
      });
    } catch {
      fallbackPendingNavigationTransition(pending);
    }
  });

  if (!unsubscribe) {
    return;
  }

  navigationApiListenerBound = true;
}

function bindPopstate(): void {
  if (popstateBound || typeof window === "undefined") {
    return;
  }

  popstateBound = true;
  window.addEventListener("popstate", () => {
    const targetUrl = new URL(window.location.href);
    void navigateToInternal(targetUrl, {
      replace: true,
      scroll: false,
      isPopState: true,
    });
  });
}

export async function prefetchTo(to: string): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  if (!runtimeState) {
    return;
  }
  const state = runtimeState;
  const toUrl = new URL(to, window.location.href);
  if (!isInternalUrl(toUrl)) {
    return;
  }

  const matched = matchClientPageRoute(state.routerSnapshot.pages, toUrl.pathname);
  const routeId = matched?.route.id ?? null;
  getOrCreatePrefetchEntry(toUrl, routeId, state.routerSnapshot);
}

export async function navigateWithNavigationApiOrFallback(
  to: string,
  options: NavigateOptions = {},
): Promise<NavigateResult | null> {
  if (typeof window === "undefined") {
    return null;
  }

  const toUrl = new URL(to, window.location.href);
  if (!isInternalUrl(toUrl)) {
    hardNavigate(toUrl);
    return null;
  }

  if (!runtimeState) {
    hardNavigate(toUrl);
    return null;
  }

  bindNavigationApiNavigateListener();
  if (!canNavigationNavigateWithIntercept()) {
    return navigateToInternal(toUrl, options);
  }

  const transitionId = nextNavigationTransitionId();
  const pendingPromise = createPendingNavigationTransition({
    id: transitionId,
    toUrl,
    replace: Boolean(options.replace),
    scroll: options.scroll !== false,
    onNavigate: options.onNavigate,
  });

  const history: NavigationHistoryMode = options.replace ? "replace" : "push";
  const dispatchResult = dispatchNavigationNavigate(toUrl.toString(), {
    history,
    info: {
      __rbssrTransition: true,
      id: transitionId,
    } satisfies FrameworkNavigationInfo,
  });

  if (!dispatchResult.dispatched) {
    cancelPendingNavigationTransition(transitionId);
    return navigateToInternal(toUrl, options);
  }

  if (dispatchResult.committed) {
    const committed = await dispatchResult.committed;
    if (!committed) {
      cancelPendingNavigationTransition(transitionId);
      return navigateToInternal(toUrl, options);
    }
  }

  return pendingPromise;
}

export async function navigateTo(to: string, options: NavigateOptions = {}): Promise<NavigateResult | null> {
  if (typeof window === "undefined") {
    return null;
  }

  const toUrl = new URL(to, window.location.href);
  if (!isInternalUrl(toUrl)) {
    hardNavigate(toUrl);
    return null;
  }

  if (!runtimeState) {
    hardNavigate(toUrl);
    return null;
  }

  return navigateToInternal(toUrl, options);
}

export function registerRouteModules(routeId: string, modules: RouteModuleBundle): void {
  moduleRegistry.set(routeId, modules);
  if (runtimeState) {
    runtimeState.moduleRegistry.set(routeId, modules);
  }
}

export function hydrateInitialRoute(routeId: string): void {
  if (typeof document === "undefined" || runtimeState) {
    return;
  }

  const payload = reviveDeferredPayload(getScriptJson<RenderPayload>(RBSSR_PAYLOAD_SCRIPT_ID));
  const routerSnapshot = getScriptJson<ClientRouterSnapshot>(RBSSR_ROUTER_SCRIPT_ID);
  const modules = moduleRegistry.get(routeId);
  if (!modules) {
    throw new Error(`Missing module registry for initial route "${routeId}"`);
  }

  const container = document.getElementById("rbssr-root");
  if (!container) {
    throw new Error("Missing #rbssr-root hydration container");
  }

  const appTree = payload.error
    ? isRouteErrorResponse(payload.error)
      ? createCatchAppTree(modules, payload, payload.error)
      : createErrorAppTree(modules, payload, new Error(messageFromPayloadError(payload.error)))
    : createPageAppTree(modules, payload);
  if (!appTree) {
    throw new Error("Failed to create initial app tree.");
  }

  const root = hydrateRoot(container, appTree);
  runtimeState = {
    root,
    currentPayload: payload,
    currentRouteId: routeId,
    currentModules: modules,
    routerSnapshot,
    moduleRegistry,
    prefetchCache: new Map(),
    navigationToken: 0,
    transitionAbortController: null,
  };

  ensureRouteAnnouncer();
  bindNavigationApiNavigateListener();
  bindPopstate();
}
