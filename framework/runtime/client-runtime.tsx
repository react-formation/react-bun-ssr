import { hydrateRoot, type Root } from "react-dom/client";
import {
  addNavigationNavigateListener,
  canNavigationNavigateWithIntercept,
  dispatchNavigationNavigate,
  type NavigationHistoryMode,
} from "./navigation-api";
import {
  createClientNavigationSession,
  type ClientNavigationApiInfo as FrameworkNavigationInfo,
  type ClientNavigationDestinationLike,
  type ClientNavigationPrefetchEntry as PrefetchEntry,
  type ClientNavigationResult as NavigateResult,
  type ClientNavigationSessionOptions as NavigateOptions,
  type PendingClientNavigationTransition,
} from "./client-navigation-session";
import {
  RBSSR_PAYLOAD_SCRIPT_ID,
  RBSSR_ROUTER_SCRIPT_ID,
} from "./runtime-constants";
import { replaceManagedHead } from "./head-reconcile";
import {
  applyRouteWireDeferredChunk,
  createRouteWireProtocol,
  reviveRouteWirePayload,
} from "./route-wire-protocol";
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
  TransitionInitialChunk,
} from "./types";

interface DeferredClientRuntime {
  get(id: string): Promise<unknown>;
  resolve(id: string, value: unknown): void;
  reject(id: string, message: string): void;
}

interface NavigationInterceptOptionsLike {
  handler?: () => void | Promise<void>;
}

interface NavigateEventLike {
  info?: unknown;
  canIntercept?: boolean;
  userInitiated?: boolean;
  destination?: ClientNavigationDestinationLike;
  intercept?: (options: NavigationInterceptOptionsLike) => void;
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

interface ClientRuntimeSingleton {
  moduleRegistry: Map<string, RouteModuleBundle>;
  pendingNavigationTransitions: Map<string, PendingClientNavigationTransition>;
  navigationListeners: Set<(info: NavigateResult) => void>;
  runtimeState: RuntimeState | null;
  popstateBound: boolean;
  navigationApiListenerBound: boolean;
  navigationApiTransitionCounter: number;
}

declare global {
  interface Window {
    __RBSSR_DEFERRED__?: DeferredClientRuntime;
  }
}

const ROUTE_ANNOUNCER_ID = "__rbssr-route-announcer";
const CLIENT_RUNTIME_SINGLETON_KEY = Symbol.for("react-bun-ssr.client-runtime");

function getClientRuntimeSingleton(): ClientRuntimeSingleton {
  const globalRegistry = globalThis as typeof globalThis & {
    [CLIENT_RUNTIME_SINGLETON_KEY]?: ClientRuntimeSingleton;
  };
  const existing = globalRegistry[CLIENT_RUNTIME_SINGLETON_KEY];
  if (existing) {
    return existing;
  }

  const singleton: ClientRuntimeSingleton = {
    moduleRegistry: new Map(),
    pendingNavigationTransitions: new Map(),
    navigationListeners: new Set(),
    runtimeState: null,
    popstateBound: false,
    navigationApiListenerBound: false,
    navigationApiTransitionCounter: 0,
  };
  globalRegistry[CLIENT_RUNTIME_SINGLETON_KEY] = singleton;
  return singleton;
}

const clientRuntimeSingleton = getClientRuntimeSingleton();

function readCurrentWindowUrl(): URL | null {
  if (typeof window === "undefined") {
    return null;
  }

  return new URL(window.location.href);
}

function getClientRouteWireProtocol() {
  return createRouteWireProtocol({
    getCurrentUrl: readCurrentWindowUrl,
  });
}

function getDeferredRuntime(): DeferredClientRuntime | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.__RBSSR_DEFERRED__;
}

function emitNavigation(info: NavigateResult): void {
  for (const listener of clientRuntimeSingleton.navigationListeners) {
    try {
      listener(info);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("[rbssr] router navigation listener failed", error);
    }
  }
}

function pickOptionalClientModuleExport<T>(
  moduleValue: Record<string, unknown>,
  exportName: string,
): T | undefined {
  const value = moduleValue[exportName];
  return typeof value === "function" ? (value as T) : undefined;
}

export function projectClientModule(
  defaultExport: RouteModule["default"],
  moduleValue: Record<string, unknown>,
): RouteModule {
  return {
    default: defaultExport,
    Loading: pickOptionalClientModuleExport<RouteModule["Loading"]>(moduleValue, "Loading"),
    ErrorComponent: pickOptionalClientModuleExport<RouteModule["ErrorComponent"]>(moduleValue, "ErrorComponent"),
    CatchBoundary: pickOptionalClientModuleExport<RouteModule["CatchBoundary"]>(moduleValue, "CatchBoundary"),
    ErrorBoundary: pickOptionalClientModuleExport<RouteModule["ErrorBoundary"]>(moduleValue, "ErrorBoundary"),
    NotFound: pickOptionalClientModuleExport<RouteModule["NotFound"]>(moduleValue, "NotFound"),
  };
}

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

function ensureRuntimeState(): RuntimeState {
  if (!clientRuntimeSingleton.runtimeState) {
    throw new Error("Client runtime is not initialized. Ensure hydrateInitialRoute() ran first.");
  }

  return clientRuntimeSingleton.runtimeState;
}

async function ensureRouteModuleLoaded(routeId: string, snapshot: ClientRouterSnapshot): Promise<void> {
  if (clientRuntimeSingleton.moduleRegistry.has(routeId)) {
    return;
  }

  const asset = snapshot.assets[routeId];
  if (!asset?.script) {
    throw new Error(`Missing client asset script for route "${routeId}"`);
  }

  const scriptUrl = withVersionQuery(asset.script, snapshot.devVersion);
  await import(scriptUrl);
}

function createFallbackNotFoundRoute(rootModule: RouteModule): RouteModule {
  return {
    default: () => null,
    NotFound: rootModule.NotFound,
  };
}

async function renderTransitionInitial(
  chunk: TransitionInitialChunk,
  toUrl: URL,
  options: NavigateOptions & { prefetched: boolean; fromPath: string },
): Promise<NavigateResult> {
  const state = ensureRuntimeState();
  const revivedPayload = reviveRouteWirePayload(chunk.payload, getDeferredRuntime());
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
    nextUrl: new URL(toUrl.toString()),
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

function createRuntimeNavigationSession(state: RuntimeState) {
  return createClientNavigationSession({
    state,
    pendingState: clientRuntimeSingleton,
    currentUrl: new URL(window.location.href),
    routerSnapshot: state.routerSnapshot,
    protocol: getClientRouteWireProtocol(),
    onDeferredChunk: chunk => {
      applyRouteWireDeferredChunk(chunk, getDeferredRuntime());
    },
    loadRouteModule: routeId => ensureRouteModuleLoaded(routeId, state.routerSnapshot),
    renderLoading: input => {
      const matchedModules = state.moduleRegistry.get(input.routeId);
      if (!matchedModules) {
        return;
      }

      const loadingTree = createLoadingAppTree(
        matchedModules,
        {
          routeId: input.routeId,
          loaderData: null,
          params: input.params,
          url: input.url.toString(),
        },
      );
      if (loadingTree) {
        state.root.render(loadingTree);
      }
    },
    renderInitial: async (chunk, options) => {
      const { toUrl, ...renderOptions } = options;
      return renderTransitionInitial(chunk, toUrl, renderOptions);
    },
    hardNavigate,
    emitNavigation,
    setTimeout: (callback, timeoutMs) => window.setTimeout(callback, timeoutMs),
    clearTimeout: timeoutId => window.clearTimeout(timeoutId),
  });
}

async function navigateToInternal(
  toUrl: URL,
  options: NavigateOptions = {},
): Promise<NavigateResult | null> {
  const state = ensureRuntimeState();
  return createRuntimeNavigationSession(state).navigate(toUrl, options);
}

function bindNavigationApiNavigateListener(): void {
  if (clientRuntimeSingleton.navigationApiListenerBound || typeof window === "undefined") {
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

    const state = clientRuntimeSingleton.runtimeState;
    if (!state) {
      return;
    }

    const session = createRuntimeNavigationSession(state);
    const pending = session.findPendingTransitionForEvent(navigateEvent);
    if (!pending) {
      return;
    }

    const destinationHref = session.readNavigationDestinationHref(navigateEvent);
    if (!destinationHref) {
      session.fallbackPendingNavigationTransition(pending);
      return;
    }

    const destinationUrl = new URL(destinationHref, window.location.href);
    if (!isInternalUrl(destinationUrl)) {
      session.fallbackPendingNavigationTransition(pending);
      return;
    }

    try {
      navigateEvent.intercept({
        handler: async () => {
          try {
            const result = await session.navigate(destinationUrl, {
              replace: pending.replace,
              scroll: pending.scroll,
              onNavigate: pending.onNavigate,
              historyManagedByNavigationApi: true,
            });
            session.settlePendingNavigationTransition(pending, result);
          } catch {
            session.settlePendingNavigationTransition(pending, null);
          }
        },
      });
    } catch {
      session.fallbackPendingNavigationTransition(pending);
    }
  });

  if (!unsubscribe) {
    return;
  }

  clientRuntimeSingleton.navigationApiListenerBound = true;
}

function bindPopstate(): void {
  if (clientRuntimeSingleton.popstateBound || typeof window === "undefined") {
    return;
  }

  clientRuntimeSingleton.popstateBound = true;
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

  if (!clientRuntimeSingleton.runtimeState) {
    return;
  }
  const state = clientRuntimeSingleton.runtimeState;
  const toUrl = new URL(to, window.location.href);
  if (!isInternalUrl(toUrl)) {
    return;
  }

  createRuntimeNavigationSession(state).prefetch(toUrl);
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

  const state = clientRuntimeSingleton.runtimeState;
  if (!state) {
    hardNavigate(toUrl);
    return null;
  }

  bindNavigationApiNavigateListener();
  const session = createRuntimeNavigationSession(state);
  if (!canNavigationNavigateWithIntercept()) {
    return session.navigate(toUrl, options);
  }

  const transitionId = session.nextNavigationTransitionId();
  const pendingPromise = session.createPendingNavigationTransition({
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
    session.cancelPendingNavigationTransition(transitionId);
    return session.navigate(toUrl, options);
  }

  if (dispatchResult.committed) {
    const committed = await dispatchResult.committed;
    if (!committed) {
      session.cancelPendingNavigationTransition(transitionId);
      return session.navigate(toUrl, options);
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

  if (!clientRuntimeSingleton.runtimeState) {
    hardNavigate(toUrl);
    return null;
  }

  return navigateToInternal(toUrl, options);
}

export function subscribeToNavigation(listener: (info: NavigateResult) => void): () => void {
  clientRuntimeSingleton.navigationListeners.add(listener);
  return () => {
    clientRuntimeSingleton.navigationListeners.delete(listener);
  };
}

export function registerRouteModules(routeId: string, modules: RouteModuleBundle): void {
  clientRuntimeSingleton.moduleRegistry.set(routeId, modules);
  if (clientRuntimeSingleton.runtimeState) {
    clientRuntimeSingleton.runtimeState.moduleRegistry.set(routeId, modules);
  }
}

export function hydrateInitialRoute(routeId: string): void {
  if (typeof document === "undefined" || clientRuntimeSingleton.runtimeState) {
    return;
  }

  const payload = reviveRouteWirePayload(
    getScriptJson<RenderPayload>(RBSSR_PAYLOAD_SCRIPT_ID),
    getDeferredRuntime(),
  );
  const routerSnapshot = getScriptJson<ClientRouterSnapshot>(RBSSR_ROUTER_SCRIPT_ID);
  const modules = clientRuntimeSingleton.moduleRegistry.get(routeId);
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
  clientRuntimeSingleton.runtimeState = {
    root,
    currentPayload: payload,
    currentRouteId: routeId,
    currentModules: modules,
    routerSnapshot,
    moduleRegistry: clientRuntimeSingleton.moduleRegistry,
    prefetchCache: new Map(),
    navigationToken: 0,
    transitionAbortController: null,
  };

  ensureRouteAnnouncer();
  bindNavigationApiNavigateListener();
  bindPopstate();
}
