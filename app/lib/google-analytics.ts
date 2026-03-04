import { isFrameworkTestPath } from "./internal-routes";

const GOOGLE_ANALYTICS_ID = "G-NGRFMCYB9Z";

type GoogleAnalyticsCommand = [command: string, ...params: unknown[]];
type GoogleAnalyticsQueueEntry = IArguments | GoogleAnalyticsCommand;
type GoogleAnalyticsFn = (...args: GoogleAnalyticsCommand) => void;

interface GoogleAnalyticsWindow {
  dataLayer?: GoogleAnalyticsQueueEntry[];
  gtag?: GoogleAnalyticsFn;
  __RBSSR_GA_INITIAL_PATH__?: string;
  __RBSSR_GA_INITIALIZED__?: boolean;
  __RBSSR_GA_LAST_PAGE_PATH__?: string;
}

declare global {
  interface Window extends GoogleAnalyticsWindow {}
}

function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

function ensureGoogleAnalyticsRuntime(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dataLayer = window.dataLayer ?? [];
  window.__RBSSR_GA_INITIAL_PATH__ ??= `${window.location.pathname}${window.location.search}`;

  if (!window.gtag) {
    window.gtag = function gtag(this: void, ...args: GoogleAnalyticsCommand): void {
      void args;
      window.dataLayer?.push(arguments);
    };
  }
}

export function initGoogleAnalytics(): void {
  if (typeof window === "undefined" || isDevelopment()) {
    return;
  }

  if (isFrameworkTestPath(window.location.pathname)) {
    return;
  }

  ensureGoogleAnalyticsRuntime();

  if (window.__RBSSR_GA_INITIALIZED__) {
    return;
  }

  window.gtag?.("js", new Date());
  window.gtag?.("config", GOOGLE_ANALYTICS_ID);
  window.__RBSSR_GA_INITIALIZED__ = true;
}

function getContentGroup(pathname: string): string | undefined {
  if (pathname === "/docs" || pathname.startsWith("/docs/")) {
    return "docs";
  }

  return undefined;
}

export function trackPageView(url: URL): void {
  if (typeof window === "undefined" || isDevelopment()) {
    return;
  }
  if (isFrameworkTestPath(url.pathname)) {
    return;
  }

  initGoogleAnalytics();

  const pagePath = `${url.pathname}${url.search}`;
  const isInitialHydration =
    window.__RBSSR_GA_LAST_PAGE_PATH__ === undefined
    && window.__RBSSR_GA_INITIAL_PATH__ === pagePath;

  if (window.__RBSSR_GA_LAST_PAGE_PATH__ === pagePath) {
    return;
  }

  window.__RBSSR_GA_LAST_PAGE_PATH__ = pagePath;

  if (isInitialHydration) {
    return;
  }

  const eventParams: Record<string, string> = {
    page_title: document.title,
    page_location: window.location.href,
    page_path: pagePath,
  };
  const contentGroup = getContentGroup(url.pathname);
  if (contentGroup) {
    eventParams.content_group = contentGroup;
  }

  window.gtag?.("event", "page_view", eventParams);
}
