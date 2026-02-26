import { useMemo } from "react";
import { goBack, goForward, reloadPage } from "./navigation-api";

export interface RouterNavigateOptions {
  scroll?: boolean;
}

export interface Router {
  push(href: string, options?: RouterNavigateOptions): void;
  replace(href: string, options?: RouterNavigateOptions): void;
  prefetch(href: string): void;
  back(): void;
  forward(): void;
  refresh(): void;
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
};

function createClientRouter(): Router {
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
  };
}

export function useRouter(): Router {
  return useMemo(
    () => (typeof window === "undefined" ? SERVER_ROUTER : createClientRouter()),
    [],
  );
}
