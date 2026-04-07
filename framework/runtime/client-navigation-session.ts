import {
  isStaleNavigationToken,
  matchClientPageRoute,
  sanitizePrefetchCache,
  shouldSkipSoftNavigation,
} from "./client-transition-core";
import { completeRouteWireTransition, type RouteWireProtocol } from "./route-wire-protocol";
import type {
  ClientRouterSnapshot,
  Params,
  TransitionDeferredChunk,
  TransitionDocumentChunk,
  TransitionInitialChunk,
  TransitionRedirectChunk,
} from "./types";

type TransitionInitialResult = TransitionInitialChunk | TransitionRedirectChunk | TransitionDocumentChunk | null;

export interface ClientNavigationResult {
  from: string;
  to: string;
  nextUrl: URL;
  status: number;
  kind: "page" | "not_found" | "catch" | "error";
  redirected: boolean;
  prefetched: boolean;
}

export interface ClientNavigationSessionOptions {
  replace?: boolean;
  scroll?: boolean;
  onNavigate?: (info: ClientNavigationResult) => void;
  isPopState?: boolean;
  historyManagedByNavigationApi?: boolean;
  redirected?: boolean;
  redirectDepth?: number;
}

export interface ClientNavigationPrefetchEntry {
  createdAt: number;
  modulePromise: Promise<void>;
  initialPromise: Promise<TransitionInitialResult>;
  donePromise: Promise<void>;
}

export interface ClientNavigationSessionState {
  prefetchCache: Map<string, ClientNavigationPrefetchEntry>;
  navigationToken: number;
  transitionAbortController: AbortController | null;
}

export interface ClientNavigationApiInfo {
  __rbssrTransition: true;
  id: string;
}

export interface ClientNavigationDestinationLike {
  url?: string | URL;
}

export interface ClientNavigationEventLike {
  info?: unknown;
  userInitiated?: boolean;
  destination?: ClientNavigationDestinationLike;
}

export interface PendingClientNavigationTransition {
  id: string;
  destinationHref: string;
  replace: boolean;
  scroll: boolean;
  onNavigate?: (info: ClientNavigationResult) => void;
  createdAt: number;
  resolve: (value: ClientNavigationResult | null) => void;
  settled: boolean;
  timeoutId: number;
}

export interface ClientNavigationPendingState {
  pendingNavigationTransitions: Map<string, PendingClientNavigationTransition>;
  navigationApiTransitionCounter: number;
}

export interface ClientNavigationLoadingInput {
  routeId: string;
  params: Params;
  url: URL;
}

export interface ClientNavigationSessionDeps {
  state: ClientNavigationSessionState;
  pendingState?: ClientNavigationPendingState;
  currentUrl: URL;
  routerSnapshot: ClientRouterSnapshot;
  protocol: RouteWireProtocol;
  onDeferredChunk?: (chunk: TransitionDeferredChunk) => void;
  loadRouteModule(routeId: string): Promise<void>;
  renderLoading(input: ClientNavigationLoadingInput): void;
  renderInitial(
    chunk: TransitionInitialChunk,
    options: ClientNavigationSessionOptions & {
      prefetched: boolean;
      fromPath: string;
      toUrl: URL;
    },
  ): Promise<ClientNavigationResult>;
  hardNavigate(url: URL): void;
  emitNavigation(info: ClientNavigationResult): void;
  now?: () => number;
  setTimeout?: (callback: () => void, timeoutMs: number) => number;
  clearTimeout?: (timeoutId: number) => void;
  pendingTimeoutMs?: number;
  pendingMatchWindowMs?: number;
}

export interface ClientNavigationSession {
  prefetch(toUrl: URL, options?: { signal?: AbortSignal }): void;
  navigate(toUrl: URL, options?: ClientNavigationSessionOptions): Promise<ClientNavigationResult | null>;
  nextNavigationTransitionId(): string;
  createPendingNavigationTransition(options: {
    id: string;
    toUrl: URL;
    replace: boolean;
    scroll: boolean;
    onNavigate?: (info: ClientNavigationResult) => void;
  }): Promise<ClientNavigationResult | null>;
  cancelPendingNavigationTransition(id: string): void;
  settlePendingNavigationTransition(
    transition: PendingClientNavigationTransition,
    result: ClientNavigationResult | null,
  ): void;
  fallbackPendingNavigationTransition(transition: PendingClientNavigationTransition): void;
  findPendingTransitionForEvent(event: ClientNavigationEventLike): PendingClientNavigationTransition | null;
  readNavigationDestinationHref(event: ClientNavigationEventLike): string | null;
}

function toPath(url: URL): string {
  return url.pathname + url.search + url.hash;
}

export function createClientNavigationSession(
  deps: ClientNavigationSessionDeps,
): ClientNavigationSession {
  const now = deps.now ?? Date.now;
  const setTimer = deps.setTimeout
    ?? ((callback, timeoutMs) => globalThis.setTimeout(callback, timeoutMs) as unknown as number);
  const clearTimer = deps.clearTimeout ?? ((timeoutId) => globalThis.clearTimeout(timeoutId));
  const pendingTimeoutMs = deps.pendingTimeoutMs ?? 1_500;
  const pendingMatchWindowMs = deps.pendingMatchWindowMs ?? 10_000;

  function requirePendingState(): ClientNavigationPendingState {
    if (!deps.pendingState) {
      throw new Error("Client navigation pending state is required for Navigation API coordination.");
    }

    return deps.pendingState;
  }

  function getPrefetchKey(toUrl: URL): string {
    return toPath(toUrl);
  }

  function getRouteMatch(toUrl: URL) {
    return matchClientPageRoute(deps.routerSnapshot.pages, toUrl.pathname);
  }

  function getOrCreatePrefetchEntry(
    toUrl: URL,
    options: { signal?: AbortSignal } = {},
  ): ClientNavigationPrefetchEntry {
    sanitizePrefetchCache(deps.state.prefetchCache, { now: now() });

    const cacheKey = getPrefetchKey(toUrl);
    const existing = deps.state.prefetchCache.get(cacheKey);
    if (existing) {
      return existing;
    }

    const matched = getRouteMatch(toUrl);
    const modulePromise = matched
      ? deps.loadRouteModule(matched.route.id).catch(() => undefined)
      : Promise.resolve();
    const transition = deps.protocol.startTransition({
      to: toUrl,
      onDeferredChunk: deps.onDeferredChunk,
      signal: options.signal,
    });

    const initialPromise = transition.initialPromise.catch(() => {
      deps.state.prefetchCache.delete(cacheKey);
      return null;
    });
    const donePromise = transition.donePromise.catch(() => {
      deps.state.prefetchCache.delete(cacheKey);
    });

    const entry = {
      createdAt: now(),
      modulePromise,
      initialPromise,
      donePromise,
    };

    deps.state.prefetchCache.set(cacheKey, entry);
    return entry;
  }

  function isClientNavigationInfo(value: unknown): value is ClientNavigationApiInfo {
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
    return new URL(href, deps.currentUrl).toString();
  }

  function readNavigationDestinationHref(event: ClientNavigationEventLike): string | null {
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
    const pendingState = requirePendingState();
    const entry = pendingState.pendingNavigationTransitions.get(id);
    if (!entry) {
      return;
    }

    clearTimer(entry.timeoutId);
    pendingState.pendingNavigationTransitions.delete(id);
  }

  function settlePendingNavigationTransition(
    transition: PendingClientNavigationTransition,
    result: ClientNavigationResult | null,
  ): void {
    if (transition.settled) {
      return;
    }

    transition.settled = true;
    clearPendingNavigationTransition(transition.id);
    transition.resolve(result);
  }

  function cancelPendingNavigationTransition(id: string): void {
    const pendingState = requirePendingState();
    const pending = pendingState.pendingNavigationTransitions.get(id);
    if (!pending || pending.settled) {
      return;
    }

    pending.settled = true;
    clearPendingNavigationTransition(id);
    pending.resolve(null);
  }

  function fallbackPendingNavigationTransition(transition: PendingClientNavigationTransition): void {
    if (transition.settled) {
      return;
    }

    transition.settled = true;
    clearPendingNavigationTransition(transition.id);
    void navigate(new URL(transition.destinationHref), {
      replace: transition.replace,
      scroll: transition.scroll,
      onNavigate: transition.onNavigate,
    }).then(result => {
      transition.resolve(result);
    });
  }

  function findPendingTransitionForEvent(event: ClientNavigationEventLike): PendingClientNavigationTransition | null {
    const pendingState = requirePendingState();
    if (isClientNavigationInfo(event.info)) {
      return pendingState.pendingNavigationTransitions.get(event.info.id) ?? null;
    }

    if (event.userInitiated) {
      return null;
    }

    const destinationHref = readNavigationDestinationHref(event);
    if (!destinationHref) {
      return null;
    }

    const currentTime = now();
    let bestMatch: PendingClientNavigationTransition | null = null;
    for (const candidate of pendingState.pendingNavigationTransitions.values()) {
      if (candidate.destinationHref !== destinationHref) {
        continue;
      }

      if (currentTime - candidate.createdAt > pendingMatchWindowMs) {
        continue;
      }

      if (!bestMatch || candidate.createdAt > bestMatch.createdAt) {
        bestMatch = candidate;
      }
    }

    return bestMatch;
  }

  function nextNavigationTransitionId(): string {
    const pendingState = requirePendingState();
    pendingState.navigationApiTransitionCounter += 1;
    return `rbssr-nav-${now()}-${pendingState.navigationApiTransitionCounter}`;
  }

  function createPendingNavigationTransition(options: {
    id: string;
    toUrl: URL;
    replace: boolean;
    scroll: boolean;
    onNavigate?: (info: ClientNavigationResult) => void;
  }): Promise<ClientNavigationResult | null> {
    const pendingState = requirePendingState();
    return new Promise(resolve => {
      const timeoutId = setTimer(() => {
        const pending = pendingState.pendingNavigationTransitions.get(options.id);
        if (!pending || pending.settled) {
          return;
        }

        pending.settled = true;
        clearPendingNavigationTransition(options.id);
        void navigate(options.toUrl, {
          replace: options.replace,
          scroll: options.scroll,
          onNavigate: options.onNavigate,
        }).then(result => {
          resolve(result);
        });
      }, pendingTimeoutMs);

      pendingState.pendingNavigationTransitions.set(options.id, {
        id: options.id,
        destinationHref: options.toUrl.toString(),
        replace: options.replace,
        scroll: options.scroll,
        onNavigate: options.onNavigate,
        createdAt: now(),
        resolve,
        settled: false,
        timeoutId,
      });
    });
  }

  async function navigate(
    toUrl: URL,
    options: ClientNavigationSessionOptions = {},
  ): Promise<ClientNavigationResult | null> {
    const currentPath = toPath(deps.currentUrl);
    const targetPath = toPath(toUrl);

    if (shouldSkipSoftNavigation(currentPath, targetPath, options)) {
      return null;
    }

    if (deps.state.transitionAbortController) {
      deps.state.transitionAbortController.abort();
    }

    const abortController = new AbortController();
    deps.state.transitionAbortController = abortController;

    const prefetchKey = getPrefetchKey(toUrl);
    const existingPrefetch = deps.state.prefetchCache.get(prefetchKey);
    const prefetchEntry = existingPrefetch
      ?? getOrCreatePrefetchEntry(toUrl, { signal: abortController.signal });
    const usedPrefetch = Boolean(existingPrefetch);
    deps.state.navigationToken += 1;
    const navigationToken = deps.state.navigationToken;

    try {
      await prefetchEntry.modulePromise;
      if (isStaleNavigationToken(deps.state.navigationToken, navigationToken)) {
        return null;
      }

      const matched = getRouteMatch(toUrl);
      if (matched) {
        deps.renderLoading({
          routeId: matched.route.id,
          params: matched.params,
          url: toUrl,
        });
      }

      const initial = await prefetchEntry.initialPromise;
      if (isStaleNavigationToken(deps.state.navigationToken, navigationToken)) {
        return null;
      }

      if (!initial) {
        throw new Error("Transition response did not include an initial payload.");
      }

      return completeRouteWireTransition(initial, {
        currentUrl: deps.currentUrl,
        redirectDepth: options.redirectDepth,
        render: async chunk => {
          const result = await deps.renderInitial(chunk, {
            ...options,
            prefetched: usedPrefetch,
            fromPath: currentPath,
            toUrl,
          });
          options.onNavigate?.(result);
          deps.emitNavigation(result);
          return result;
        },
        softNavigate: async (location, redirectInfo) => {
          return navigate(new URL(location, deps.currentUrl), {
            ...options,
            replace: redirectInfo.replace,
            redirected: redirectInfo.redirected,
            redirectDepth: redirectInfo.redirectDepth,
            historyManagedByNavigationApi: false,
          });
        },
        hardNavigate: location => {
          deps.hardNavigate(new URL(location, deps.currentUrl));
        },
      });
    } catch {
      deps.hardNavigate(toUrl);
      return null;
    } finally {
      if (deps.state.transitionAbortController === abortController) {
        deps.state.transitionAbortController = null;
      }
    }
  }

  return {
    prefetch(toUrl, options = {}) {
      getOrCreatePrefetchEntry(toUrl, options);
    },

    navigate,
    nextNavigationTransitionId,
    createPendingNavigationTransition,
    cancelPendingNavigationTransition,
    settlePendingNavigationTransition,
    fallbackPendingNavigationTransition,
    findPendingTransitionForEvent,
    readNavigationDestinationHref,
  };
}
