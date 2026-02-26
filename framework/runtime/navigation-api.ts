export type NavigationHistoryMode = "push" | "replace";

export interface NavigationDispatchOptions {
  history: NavigationHistoryMode;
  info?: unknown;
}

export interface NavigationDispatchResult {
  dispatched: boolean;
  committed: Promise<boolean> | null;
}

interface NavigationNavigateResultLike {
  committed?: unknown;
}

interface NavigationLike {
  back?: () => unknown;
  forward?: () => unknown;
  reload?: () => unknown;
  navigate?: (url: string, options?: NavigationDispatchOptions) => unknown;
  addEventListener?: (type: string, listener: (event: unknown) => void) => void;
  removeEventListener?: (type: string, listener: (event: unknown) => void) => void;
}

function getNavigation(): NavigationLike | null {
  if (typeof window === "undefined") {
    return null;
  }

  const candidate = (window as Window & { navigation?: unknown }).navigation;
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  return candidate as NavigationLike;
}

function hasNavigateEventInterceptSupport(): boolean {
  const candidate = (globalThis as {
    NavigateEvent?: { prototype?: { intercept?: unknown } };
  }).NavigateEvent;

  return typeof candidate?.prototype?.intercept === "function";
}

function isThenable(value: unknown): value is Promise<unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return typeof (value as Promise<unknown>).then === "function";
}

function toCommittedOutcomePromise(value: unknown): Promise<boolean> | null {
  if (isThenable(value)) {
    return value.then(
      () => true,
      () => false,
    );
  }

  if (typeof value !== "object" || value === null) {
    return null;
  }

  const committed = (value as NavigationNavigateResultLike).committed;
  if (!isThenable(committed)) {
    return null;
  }

  return committed.then(
    () => true,
    () => false,
  );
}

export function hasNavigationApi(): boolean {
  return getNavigation() !== null;
}

export function canNavigationBack(): boolean {
  return typeof getNavigation()?.back === "function";
}

export function canNavigationForward(): boolean {
  return typeof getNavigation()?.forward === "function";
}

export function canNavigationReload(): boolean {
  return typeof getNavigation()?.reload === "function";
}

export function canNavigationNavigateWithIntercept(): boolean {
  const navigation = getNavigation();
  if (!navigation) {
    return false;
  }

  return (
    typeof navigation.navigate === "function"
    && typeof navigation.addEventListener === "function"
    && typeof navigation.removeEventListener === "function"
    && hasNavigateEventInterceptSupport()
  );
}

export function dispatchNavigationNavigate(
  url: string,
  options: NavigationDispatchOptions,
): NavigationDispatchResult {
  const navigation = getNavigation();
  if (!navigation || typeof navigation.navigate !== "function") {
    return {
      dispatched: false,
      committed: null,
    };
  }

  try {
    const result = navigation.navigate(url, options);
    return {
      dispatched: true,
      committed: toCommittedOutcomePromise(result),
    };
  } catch {
    return {
      dispatched: false,
      committed: null,
    };
  }
}

export function addNavigationNavigateListener(
  listener: (event: unknown) => void,
): (() => void) | null {
  const navigation = getNavigation();
  if (
    !navigation
    || typeof navigation.addEventListener !== "function"
    || typeof navigation.removeEventListener !== "function"
  ) {
    return null;
  }

  navigation.addEventListener("navigate", listener);
  return () => {
    try {
      navigation.removeEventListener?.("navigate", listener);
    } catch {
      // noop cleanup
    }
  };
}

export function goBack(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const navigation = getNavigation();
    if (navigation && typeof navigation.back === "function") {
      const result = navigation.back();
      if (result && typeof (result as Promise<unknown>).catch === "function") {
        void (result as Promise<unknown>).catch(() => {
          window.history.back();
        });
      }
      return;
    }
  } catch {
    // fall through to history fallback
  }

  window.history.back();
}

export function goForward(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const navigation = getNavigation();
    if (navigation && typeof navigation.forward === "function") {
      const result = navigation.forward();
      if (result && typeof (result as Promise<unknown>).catch === "function") {
        void (result as Promise<unknown>).catch(() => {
          window.history.forward();
        });
      }
      return;
    }
  } catch {
    // fall through to history fallback
  }

  window.history.forward();
}

export function reloadPage(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const navigation = getNavigation();
    if (navigation && typeof navigation.reload === "function") {
      const result = navigation.reload();
      if (result && typeof (result as Promise<unknown>).catch === "function") {
        void (result as Promise<unknown>).catch(() => {
          window.location.reload();
        });
      }
      return;
    }
  } catch {
    // fall through to location fallback
  }

  window.location.reload();
}
