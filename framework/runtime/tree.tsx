import {
  createContext,
  useContext,
  type ComponentType,
  type ReactElement,
  type ReactNode,
} from "react";
import type { Params, RenderPayload, RouteModuleBundle } from "./types";

interface RuntimeState {
  data: unknown;
  params: Params;
  url: URL;
  error?: unknown;
}

const RuntimeContext = createContext<RuntimeState | null>(null);
const OutletContext = createContext<ReactNode>(null);

function useRuntimeState(): RuntimeState {
  const state = useContext(RuntimeContext);
  if (!state) {
    throw new Error("react-bun-ssr hooks must be used inside a framework route tree");
  }
  return state;
}

export function useLoaderData<T = unknown>(): T {
  return useRuntimeState().data as T;
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
): ReactElement {
  const runtimeState: RuntimeState = {
    data: payload.data,
    params: payload.params,
    url: new URL(payload.url),
    error: payload.error,
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
