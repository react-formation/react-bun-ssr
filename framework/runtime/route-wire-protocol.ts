import {
  consumeTransitionChunkText,
  createTransitionChunkParserState,
  flushTransitionChunkText,
} from "./client-transition-core";
import type { RouteActionStateHandler } from "./action-stub";
import { markRouteActionStub } from "./action-stub";
import { isDeferredToken } from "./deferred";
import type {
  ActionResponseEnvelope,
  RenderPayload,
  RouteErrorResponse,
  TransitionDeferredChunk,
  TransitionDocumentChunk,
  TransitionInitialChunk,
  TransitionRedirectChunk,
} from "./types";

export interface RouteWireNavigationPlan {
  kind: "soft" | "hard";
  location: string;
  replace: boolean;
}

export interface RouteWireActionDataOutcome {
  type: "data";
  status: number;
  data: unknown;
}

export interface RouteWireActionRedirectOutcome {
  type: "redirect";
  status: number;
  navigation: RouteWireNavigationPlan;
}

export interface RouteWireActionCatchOutcome {
  type: "catch";
  status: number;
  error: RouteErrorResponse;
}

export interface RouteWireActionErrorOutcome {
  type: "error";
  status: number;
  message: string;
}

export type RouteWireActionOutcome =
  | RouteWireActionDataOutcome
  | RouteWireActionRedirectOutcome
  | RouteWireActionCatchOutcome
  | RouteWireActionErrorOutcome;

const MAX_REDIRECT_DEPTH = 8;

function shouldHardNavigateForRedirectDepth(
  depth: number,
  maxDepth = MAX_REDIRECT_DEPTH,
): boolean {
  return depth > maxDepth;
}

export interface RouteWireProtocol {
  submitAction(input: {
    to: string;
    formData: FormData;
  }): Promise<RouteWireActionOutcome>;

  startTransition(input: {
    to: string | URL;
    onDeferredChunk?: (chunk: TransitionDeferredChunk) => void;
    signal?: AbortSignal;
  }): RouteWireTransitionHandle;
}

export interface RouteWire {
  action<TState = unknown>(target?: string | URL): RouteActionStateHandler<TState>;
}

export interface RouteWireDeps {
  fetchImpl?: typeof fetch;
  getCurrentUrl: () => URL | null;
  hardNavigate?: (location: string) => void;
  softNavigate?: (location: string, options: { replace?: boolean }) => Promise<void>;
}

export interface RouteWireTransitionHandle {
  initialPromise: Promise<TransitionInitialChunk | TransitionRedirectChunk | TransitionDocumentChunk | null>;
  donePromise: Promise<void>;
}

export interface RouteWireTransitionRenderOutcome {
  type: "render";
  chunk: TransitionInitialChunk;
}

export interface RouteWireTransitionNavigateOutcome {
  type: "navigate";
  navigation: RouteWireNavigationPlan;
  redirected: boolean;
  redirectDepth: number;
}

export type RouteWireTransitionInitialOutcome =
  | RouteWireTransitionRenderOutcome
  | RouteWireTransitionNavigateOutcome;

export interface RouteWireDeferredRuntime {
  get(id: string): Promise<unknown>;
  resolve(id: string, value: unknown): void;
  reject(id: string, message: string): void;
}

function isActionResponseEnvelope(value: unknown): value is ActionResponseEnvelope {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as {
    type?: unknown;
    status?: unknown;
  };
  return typeof candidate.type === "string" && typeof candidate.status === "number";
}

function resolveRequiredCurrentUrl(getCurrentUrl: () => URL | null): URL {
  const currentUrl = getCurrentUrl();
  if (!currentUrl) {
    throw new Error("Route wire protocol requires a current URL.");
  }
  return currentUrl;
}

function resolveActionRedirect(
  location: string,
  currentUrl: URL,
): RouteWireActionRedirectOutcome {
  const redirectUrl = new URL(location, currentUrl.toString());
  return {
    type: "redirect",
    status: 302,
    navigation: {
      kind: redirectUrl.origin === currentUrl.origin ? "soft" : "hard",
      location: redirectUrl.toString(),
      replace: true,
    },
  };
}

function createTransitionUrl(
  to: string | URL,
  currentUrl: URL,
): URL {
  const transitionUrl = new URL("/__rbssr/transition", currentUrl.origin);
  const toUrl = typeof to === "string"
    ? new URL(to, currentUrl)
    : new URL(to.toString(), currentUrl);
  transitionUrl.searchParams.set("to", toUrl.pathname + toUrl.search + toUrl.hash);
  return transitionUrl;
}

async function defaultSoftNavigate(
  location: string,
  options: { replace?: boolean },
): Promise<void> {
  const runtime = await import("./client-runtime");
  await runtime.navigateWithNavigationApiOrFallback(location, options);
}

function resolveActionTarget(target: string | URL | undefined, currentUrl: URL): string {
  if (typeof target === "undefined") {
    return currentUrl.pathname + currentUrl.search + currentUrl.hash;
  }

  const targetUrl = typeof target === "string"
    ? new URL(target, currentUrl)
    : new URL(target.toString(), currentUrl);

  return targetUrl.pathname + targetUrl.search + targetUrl.hash;
}

async function executeActionNavigationPlan(
  plan: RouteWireNavigationPlan,
  deps: RouteWireDeps,
): Promise<void> {
  if (plan.kind === "hard") {
    deps.hardNavigate?.(plan.location);
    return;
  }

  try {
    if (deps.softNavigate) {
      await deps.softNavigate(plan.location, { replace: plan.replace });
      return;
    }

    await defaultSoftNavigate(plan.location, { replace: plan.replace });
  } catch {
    deps.hardNavigate?.(plan.location);
  }
}

export function reviveRouteWirePayload(
  payload: RenderPayload,
  runtime?: Pick<RouteWireDeferredRuntime, "get">,
): RenderPayload {
  const sourceData = payload.loaderData;
  if (!sourceData || Array.isArray(sourceData) || typeof sourceData !== "object") {
    return payload;
  }

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
    loaderData: revivedData,
  };
}

export function applyRouteWireDeferredChunk(
  chunk: TransitionDeferredChunk,
  runtime?: Pick<RouteWireDeferredRuntime, "resolve" | "reject">,
): void {
  if (!runtime) {
    return;
  }

  if (chunk.ok) {
    runtime.resolve(chunk.id, chunk.value);
    return;
  }

  runtime.reject(chunk.id, chunk.error ?? "Deferred value rejected");
}

export function resolveRouteWireTransitionInitial(
  chunk: TransitionInitialChunk | TransitionRedirectChunk | TransitionDocumentChunk,
  options: {
    currentUrl: URL;
    redirectDepth?: number;
    maxRedirectDepth?: number;
  },
): RouteWireTransitionInitialOutcome {
  if (chunk.type === "initial") {
    return {
      type: "render",
      chunk,
    };
  }

  if (chunk.type === "document") {
    return {
      type: "navigate",
      navigation: {
        kind: "hard",
        location: new URL(chunk.location, options.currentUrl).toString(),
        replace: true,
      },
      redirected: false,
      redirectDepth: options.redirectDepth ?? 0,
    };
  }

  const redirectUrl = new URL(chunk.location, options.currentUrl);
  const redirectDepth = (options.redirectDepth ?? 0) + 1;
  const hardNavigate = (
    redirectUrl.origin !== options.currentUrl.origin
    || shouldHardNavigateForRedirectDepth(redirectDepth, options.maxRedirectDepth)
  );

  return {
    type: "navigate",
    navigation: {
      kind: hardNavigate ? "hard" : "soft",
      location: redirectUrl.toString(),
      replace: true,
    },
    redirected: true,
    redirectDepth,
  };
}

export async function completeRouteWireTransition<TResult>(
  chunk: TransitionInitialChunk | TransitionRedirectChunk | TransitionDocumentChunk,
  options: {
    currentUrl: URL;
    redirectDepth?: number;
    maxRedirectDepth?: number;
    render: (chunk: TransitionInitialChunk) => Promise<TResult>;
    softNavigate: (
      location: string,
      info: {
        replace: boolean;
        redirected: boolean;
        redirectDepth: number;
      },
    ) => Promise<TResult | null>;
    hardNavigate: (location: string) => void;
  },
): Promise<TResult | null> {
  const outcome = resolveRouteWireTransitionInitial(chunk, {
    currentUrl: options.currentUrl,
    redirectDepth: options.redirectDepth,
    maxRedirectDepth: options.maxRedirectDepth,
  });

  if (outcome.type === "render") {
    return options.render(outcome.chunk);
  }

  if (outcome.navigation.kind === "hard") {
    options.hardNavigate(outcome.navigation.location);
    return null;
  }

  return options.softNavigate(outcome.navigation.location, {
    replace: outcome.navigation.replace,
    redirected: outcome.redirected,
    redirectDepth: outcome.redirectDepth,
  });
}

export function createRouteWireProtocol(deps: Pick<RouteWireDeps, "fetchImpl" | "getCurrentUrl">): RouteWireProtocol {
  return {
    async submitAction(input) {
      const currentUrl = resolveRequiredCurrentUrl(deps.getCurrentUrl);
      const endpoint = new URL("/__rbssr/action", currentUrl.origin);
      endpoint.searchParams.set("to", input.to);

      const response = await (deps.fetchImpl ?? fetch)(endpoint.toString(), {
        method: "POST",
        body: input.formData,
        credentials: "same-origin",
        headers: {
          accept: "application/json",
        },
      });

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new Error("Action endpoint returned a non-JSON response.");
      }

      if (!isActionResponseEnvelope(payload)) {
        throw new Error("Action endpoint returned an invalid envelope.");
      }

      if (payload.type === "data") {
        return payload;
      }

      if (payload.type === "redirect") {
        return {
          ...resolveActionRedirect(payload.location, currentUrl),
          status: payload.status,
        };
      }

      if (payload.type === "catch") {
        return payload;
      }

      return payload;
    },

    startTransition(input) {
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
        const currentUrl = resolveRequiredCurrentUrl(deps.getCurrentUrl);
        const endpoint = createTransitionUrl(input.to, currentUrl);
        const response = await (deps.fetchImpl ?? fetch)(endpoint.toString(), {
          method: "GET",
          credentials: "same-origin",
          signal: input.signal,
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
            input.onDeferredChunk?.(chunk);
          }
        }

        const previousInitialChunk = parserState.initialChunk;
        const previousDeferredCount = parserState.deferredChunks.length;
        parserState = flushTransitionChunkText(parserState);

        if (!previousInitialChunk && parserState.initialChunk) {
          resolveInitial(parserState.initialChunk);
        }

        for (const chunk of parserState.deferredChunks.slice(previousDeferredCount)) {
          input.onDeferredChunk?.(chunk);
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
    },
  };
}

export function createRouteWire(deps: RouteWireDeps): RouteWire {
  const protocol = createRouteWireProtocol(deps);

  return {
    action<TState = unknown>(target?: string | URL): RouteActionStateHandler<TState> {
      return markRouteActionStub(async (previousState: TState, formData: FormData) => {
        const currentUrl = deps.getCurrentUrl();
        if (!currentUrl) {
          return previousState;
        }

        const outcome = await protocol.submitAction({
          to: resolveActionTarget(target, currentUrl),
          formData,
        });

        if (outcome.type === "data") {
          return outcome.data as TState;
        }

        if (outcome.type === "redirect") {
          await executeActionNavigationPlan(outcome.navigation, deps);
          return previousState;
        }

        if (outcome.type === "catch") {
          throw outcome.error;
        }

        throw new Error(outcome.message);
      });
    },
  };
}
