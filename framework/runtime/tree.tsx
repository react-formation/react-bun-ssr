import {
  createContext,
  useCallback,
  useContext,
  type ComponentType,
  type Context,
  type ReactElement,
  type ReactNode,
} from "react";
import type {
  ActionResponseEnvelope,
  Params,
  RenderPayload,
  RouteErrorResponse,
  RouteModuleBundle,
} from "./types";
import { markRouteActionStub, type RouteActionStateHandler } from "./action-stub";

interface RuntimeState {
  loaderData: unknown;
  params: Params;
  url: URL;
  error?: unknown;
  reset: () => void;
}

const RUNTIME_CONTEXT_KEY = Symbol.for("react-bun-ssr.runtime-context");
const OUTLET_CONTEXT_KEY = Symbol.for("react-bun-ssr.outlet-context");

function getGlobalContext<T>(key: symbol, createValue: () => Context<T>): Context<T> {
  const globalRegistry = globalThis as typeof globalThis & { [contextKey: symbol]: Context<T> | undefined };
  const existing = globalRegistry[key];
  if (existing) {
    return existing;
  }

  const context = createValue();
  globalRegistry[key] = context;
  return context;
}

const RuntimeContext = getGlobalContext<RuntimeState | null>(
  RUNTIME_CONTEXT_KEY,
  () => createContext<RuntimeState | null>(null),
);
const OutletContext = getGlobalContext<ReactNode>(
  OUTLET_CONTEXT_KEY,
  () => createContext<ReactNode>(null),
);
const NOOP_RESET = () => undefined;

function useRuntimeState(): RuntimeState {
  const state = useContext(RuntimeContext);
  if (!state) {
    throw new Error("react-bun-ssr hooks must be used inside a framework route tree");
  }
  return state;
}

export function useLoaderData<T = unknown>(): T {
  return useRuntimeState().loaderData as T;
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

async function handleActionRedirect(location: string): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  const redirectUrl = new URL(location, window.location.href);
  if (redirectUrl.origin !== window.location.origin) {
    window.location.assign(redirectUrl.toString());
    return;
  }

  try {
    const runtime = await import("./client-runtime");
    await runtime.navigateWithNavigationApiOrFallback(redirectUrl.toString(), {
      replace: true,
    });
  } catch {
    window.location.assign(redirectUrl.toString());
  }
}

async function submitRouteAction<TState>(options: {
  previousState: TState;
  formData: FormData;
  routeTarget: string;
}): Promise<TState> {
  if (typeof window === "undefined") {
    return options.previousState;
  }

  const endpoint = new URL("/__rbssr/action", window.location.origin);
  endpoint.searchParams.set("to", options.routeTarget);

  const response = await fetch(endpoint.toString(), {
    method: "POST",
    body: options.formData,
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
    return payload.data as TState;
  }

  if (payload.type === "redirect") {
    await handleActionRedirect(payload.location);
    return options.previousState;
  }

  if (payload.type === "catch") {
    throw payload.error;
  }

  throw new Error(payload.message);
}

export function createRouteAction<TState = unknown>(): RouteActionStateHandler<TState> {
  return markRouteActionStub(async (previousState: TState, formData: FormData) => {
    const routeTarget = typeof window === "undefined"
      ? "/"
      : window.location.pathname + window.location.search + window.location.hash;

    return submitRouteAction({
      previousState,
      formData,
      routeTarget,
    });
  });
}

export function useRouteAction<TState = unknown>(): RouteActionStateHandler<TState> {
  const requestUrl = useRequestUrl();
  const routeTarget = requestUrl.pathname + requestUrl.search + requestUrl.hash;

  return useCallback((previousState: TState, formData: FormData) => {
    return submitRouteAction({
      previousState,
      formData,
      routeTarget,
    });
  }, [routeTarget]);
}

export function useParams<T extends Params = Params>(): T {
  return useRuntimeState().params as T;
}

export function useRequestUrl(): URL {
  return useRuntimeState().url;
}

export function useRouteError(): unknown {
  return useRuntimeState().error;
}

export function Outlet(): ReactElement | null {
  const outlet = useContext(OutletContext);
  if (outlet === undefined || outlet === null) {
    return null;
  }
  return <>{outlet}</>;
}

export function createRouteTree(
  modules: RouteModuleBundle,
  leafElement: ReactElement,
  payload: RenderPayload,
  options: {
    error?: unknown;
    reset?: () => void;
  } = {},
): ReactElement {
  const runtimeState: RuntimeState = {
    loaderData: payload.loaderData,
    params: payload.params,
    url: new URL(payload.url),
    error: options.error ?? payload.error,
    reset: options.reset ?? NOOP_RESET,
  };

  let current: ReactNode = leafElement;

  for (let index = modules.layouts.length - 1; index >= 0; index -= 1) {
    const Layout = modules.layouts[index]!.default;
    current = (
      <OutletContext.Provider value={current}>
        <Layout />
      </OutletContext.Provider>
    );
  }

  const Root = modules.root.default;
  const tree = (
    <OutletContext.Provider value={current}>
      <Root />
    </OutletContext.Provider>
  );

  return <RuntimeContext.Provider value={runtimeState}>{tree}</RuntimeContext.Provider>;
}

function resolveCatchBoundary(
  modules: RouteModuleBundle,
): ComponentType<{ error: RouteErrorResponse; reset: () => void }> | null {
  if (modules.route.CatchBoundary) {
    return modules.route.CatchBoundary;
  }

  for (let index = modules.layouts.length - 1; index >= 0; index -= 1) {
    const candidate = modules.layouts[index]!.CatchBoundary;
    if (candidate) {
      return candidate;
    }
  }

  return modules.root.CatchBoundary ?? null;
}

function resolveErrorComponent(
  modules: RouteModuleBundle,
): ComponentType<{ error: unknown; reset: () => void }> | null {
  if (modules.route.ErrorComponent) {
    return modules.route.ErrorComponent;
  }

  for (let index = modules.layouts.length - 1; index >= 0; index -= 1) {
    const candidate = modules.layouts[index]!.ErrorComponent;
    if (candidate) {
      return candidate;
    }
  }

  return modules.root.ErrorComponent ?? null;
}

function resolveLegacyErrorBoundary(modules: RouteModuleBundle): ComponentType<{ error: unknown }> | null {
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

export function createPageAppTree(modules: RouteModuleBundle, payload: RenderPayload): ReactElement {
  const Leaf = modules.route.default;
  return createRouteTree(modules, <Leaf />, payload);
}

export function createLoadingAppTree(modules: RouteModuleBundle, payload: RenderPayload): ReactElement | null {
  const Loading = modules.route.Loading;
  if (!Loading) {
    return null;
  }

  return createRouteTree(modules, <Loading />, payload);
}

export function createErrorAppTree(
  modules: RouteModuleBundle,
  payload: RenderPayload,
  error: unknown,
  options: {
    reset?: () => void;
  } = {},
): ReactElement | null {
  const reset = options.reset ?? NOOP_RESET;

  const boundaryPayload: RenderPayload = {
    ...payload,
    error: payload.error ?? {
      message: error instanceof Error ? error.message : String(error),
    },
  };

  const ErrorComponent = resolveErrorComponent(modules);
  if (ErrorComponent) {
    return createRouteTree(modules, <ErrorComponent error={error} reset={reset} />, boundaryPayload, {
      error,
      reset,
    });
  }

  const LegacyBoundary = resolveLegacyErrorBoundary(modules);
  if (!LegacyBoundary) {
    return null;
  }

  return createRouteTree(modules, <LegacyBoundary error={error} />, boundaryPayload, {
    error,
    reset,
  });
}

export function createCatchAppTree(
  modules: RouteModuleBundle,
  payload: RenderPayload,
  routeError: RouteErrorResponse,
  options: {
    reset?: () => void;
  } = {},
): ReactElement | null {
  const reset = options.reset ?? NOOP_RESET;
  const catchPayload: RenderPayload = {
    ...payload,
    error: payload.error ?? routeError,
  };

  if (routeError.status === 404) {
    const notFoundTree = createNotFoundAppTree(modules, catchPayload);
    if (notFoundTree) {
      return notFoundTree;
    }
  }

  const CatchBoundary = resolveCatchBoundary(modules);
  if (CatchBoundary) {
    return createRouteTree(modules, <CatchBoundary error={routeError} reset={reset} />, catchPayload, {
      error: routeError,
      reset,
    });
  }

  return createErrorAppTree(modules, catchPayload, routeError, { reset });
}

export function createNotFoundAppTree(modules: RouteModuleBundle, payload: RenderPayload): ReactElement | null {
  const Boundary = resolveNotFoundBoundary(modules);
  if (!Boundary) {
    return null;
  }

  return createRouteTree(modules, <Boundary />, payload);
}
