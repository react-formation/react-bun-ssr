import { createContext, useContext, type ReactElement, type ReactNode } from "react";
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
