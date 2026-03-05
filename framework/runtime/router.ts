import { useCallback, useEffect, useMemo, useRef } from "react";
import { goBack, goForward, reloadPage } from "./navigation-api";

export interface RouterNavigateOptions {
  scroll?: boolean;
}

export interface RouterNavigateInfo {
  from: string;
  to: string;
  nextUrl: URL;
  status: number;
  kind: "page" | "not_found" | "catch" | "error";
  redirected: boolean;
  prefetched: boolean;
}

export type RouterNavigateListener = (nextUrl: URL) => void;

export interface RouterNavigateListenerStore {
  clearRenderListeners(): void;
  registerRenderListener(listener: RouterNavigateListener): void;
  promoteRenderListenersToActive(): void;
  getActiveListeners(): readonly RouterNavigateListener[];
}

export function createRouterNavigateListenerStore(): RouterNavigateListenerStore {
  let renderListeners: RouterNavigateListener[] = [];
  let activeListeners: RouterNavigateListener[] = [];

  return {
    clearRenderListeners() {
      renderListeners = [];
    },
    registerRenderListener(listener) {
      renderListeners.push(listener);
    },
    promoteRenderListenersToActive() {
      activeListeners = renderListeners;
    },
    getActiveListeners() {
      return activeListeners;
    },
  };
}

export function notifyRouterNavigateListeners(
  listeners: readonly RouterNavigateListener[],
  nextUrl: URL,
): void {
  for (const listener of listeners) {
    try {
      listener(nextUrl);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("[rbssr] router onNavigate listener failed", error);
    }
  }
}

export interface Router {
  push(href: string, options?: RouterNavigateOptions): void;
  replace(href: string, options?: RouterNavigateOptions): void;
  prefetch(href: string): void;
  back(): void;
  forward(): void;
  refresh(): void;
  onNavigate(listener: RouterNavigateListener): void;
}

function toAbsoluteHref(href: string): string {
  if (typeof window === "undefined") {
    return href;
  }
  return new URL(href, window.location.href).toString();
}

const SERVER_ROUTER: Router = {
  push: () => undefined,
  replace: () => undefined,
  prefetch: () => undefined,
  back: () => undefined,
  forward: () => undefined,
  refresh: () => undefined,
  onNavigate: () => undefined,
};

function createClientRouter(onNavigate: Router["onNavigate"]): Router {
  return {
    push: (href, options) => {
      const absoluteHref = toAbsoluteHref(href);
      void import("./client-runtime")
        .then(runtime => runtime.navigateWithNavigationApiOrFallback(absoluteHref, {
          replace: false,
          scroll: options?.scroll,
        }))
        .catch(() => {
          window.location.assign(absoluteHref);
        });
    },
    replace: (href, options) => {
      const absoluteHref = toAbsoluteHref(href);
      void import("./client-runtime")
        .then(runtime => runtime.navigateWithNavigationApiOrFallback(absoluteHref, {
          replace: true,
          scroll: options?.scroll,
        }))
        .catch(() => {
          window.location.replace(absoluteHref);
        });
    },
    prefetch: href => {
      const absoluteHref = toAbsoluteHref(href);
      void import("./client-runtime")
        .then(runtime => runtime.prefetchTo(absoluteHref))
        .catch(() => undefined);
    },
    back: () => {
      goBack();
    },
    forward: () => {
      goForward();
    },
    refresh: () => {
      reloadPage();
    },
    onNavigate,
  };
}

export function useRouter(): Router {
  const navigateListenerStoreRef = useRef<RouterNavigateListenerStore | null>(null);
  if (navigateListenerStoreRef.current === null) {
    navigateListenerStoreRef.current = createRouterNavigateListenerStore();
  }
  const navigateListenerStore = navigateListenerStoreRef.current;
  const didEmitInitialNavigationRef = useRef(false);
  navigateListenerStore.clearRenderListeners();

  const onNavigate = useCallback<Router["onNavigate"]>((listener) => {
    navigateListenerStoreRef.current?.registerRenderListener(listener);
  }, []);

  useEffect(() => {
    navigateListenerStoreRef.current?.promoteRenderListenersToActive();
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!didEmitInitialNavigationRef.current) {
      didEmitInitialNavigationRef.current = true;
      notifyRouterNavigateListeners(
        navigateListenerStore.getActiveListeners(),
        new URL(window.location.href),
      );
    }

    let unsubscribe: () => void = () => undefined;
    let active = true;

    void import("./client-runtime")
      .then(runtime => {
        if (!active) {
          return;
        }

        unsubscribe = runtime.subscribeToNavigation((info) => {
          notifyRouterNavigateListeners(
            navigateListenerStoreRef.current?.getActiveListeners() ?? [],
            info.nextUrl,
          );
        });
      })
      .catch(() => undefined);

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return useMemo(
    () => (typeof window === "undefined" ? SERVER_ROUTER : createClientRouter(onNavigate)),
    [onNavigate],
  );
}
