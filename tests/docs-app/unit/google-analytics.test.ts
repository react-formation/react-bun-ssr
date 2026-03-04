import { afterEach, describe, expect, it } from "bun:test";
import { initGoogleAnalytics, trackPageView } from "../../../app/lib/google-analytics";

type GoogleAnalyticsCommand = [command: string, ...params: unknown[]];
type GoogleAnalyticsQueueEntry = IArguments | GoogleAnalyticsCommand;

const previousWindow = (globalThis as { window?: Window }).window;
const previousDocument = (globalThis as { document?: Document }).document;
const previousNodeEnv = process.env.NODE_ENV;

function setTestDom(options: {
  href: string;
  title: string;
  referrer?: string;
}): Window & { dataLayer: GoogleAnalyticsQueueEntry[] } {
  const location = new URL(options.href);
  const windowValue = {
    location: {
      href: location.href,
      pathname: location.pathname,
      search: location.search,
    },
    dataLayer: [] as GoogleAnalyticsQueueEntry[],
  } as unknown as Window & { dataLayer: GoogleAnalyticsQueueEntry[] };

  const documentValue = {
    title: options.title,
    referrer: options.referrer ?? "",
  } as Document;

  (globalThis as { window?: Window }).window = windowValue;
  (globalThis as { document?: Document }).document = documentValue;
  return windowValue;
}

function toCommand(entry: GoogleAnalyticsQueueEntry | undefined): GoogleAnalyticsCommand | undefined {
  if (!entry) {
    return undefined;
  }

  return Array.from(entry) as GoogleAnalyticsCommand;
}

afterEach(() => {
  process.env.NODE_ENV = previousNodeEnv;

  if (previousWindow === undefined) {
    delete (globalThis as { window?: Window }).window;
  } else {
    (globalThis as { window?: Window }).window = previousWindow;
  }

  if (previousDocument === undefined) {
    delete (globalThis as { document?: Document }).document;
  } else {
    (globalThis as { document?: Document }).document = previousDocument;
  }
});

describe("google analytics page tracking", () => {
  it("skips a manual page_view for the initial hard-loaded page", () => {
    process.env.NODE_ENV = "production";
    const windowValue = setTestDom({
      href: "https://react-bun-ssr.dev/docs",
      title: "Docs",
    });

    trackPageView(new URL(windowValue.location.href));

    expect(windowValue.dataLayer).toHaveLength(2);
    expect(toCommand(windowValue.dataLayer[0])?.[0]).toBe("js");
    expect(toCommand(windowValue.dataLayer[1])?.[0]).toBe("config");
    expect(windowValue.dataLayer.some((entry) => toCommand(entry)?.[0] === "event")).toBe(false);
  });

  it("sends a docs page_view after a client transition into the docs", () => {
    process.env.NODE_ENV = "production";
    const windowValue = setTestDom({
      href: "https://react-bun-ssr.dev/blog",
      title: "Blog",
    });

    initGoogleAnalytics();

    windowValue.location.href = "https://react-bun-ssr.dev/docs/start/overview";
    windowValue.location.pathname = "/docs/start/overview";
    windowValue.location.search = "";
    document.title = "Overview";

    trackPageView(new URL(windowValue.location.href));

    expect(windowValue.dataLayer).toHaveLength(3);
    expect(toCommand(windowValue.dataLayer[2])).toEqual([
      "event",
      "page_view",
      {
        page_title: "Overview",
        page_location: "https://react-bun-ssr.dev/docs/start/overview",
        page_path: "/docs/start/overview",
        content_group: "docs",
      },
    ]);
  });

  it("sends a page_view for non-doc client transitions without docs grouping", () => {
    process.env.NODE_ENV = "production";
    const windowValue = setTestDom({
      href: "https://react-bun-ssr.dev/docs",
      title: "Docs",
    });

    initGoogleAnalytics();

    windowValue.location.href = "https://react-bun-ssr.dev/blog";
    windowValue.location.pathname = "/blog";
    windowValue.location.search = "";
    document.title = "Blog";

    trackPageView(new URL(windowValue.location.href));

    expect(windowValue.dataLayer).toHaveLength(3);
    expect(toCommand(windowValue.dataLayer[2])).toEqual([
      "event",
      "page_view",
      {
        page_title: "Blog",
        page_location: "https://react-bun-ssr.dev/blog",
        page_path: "/blog",
      },
    ]);
  });

  it("does not initialize analytics on hidden framework test routes", () => {
    process.env.NODE_ENV = "production";
    const windowValue = setTestDom({
      href: "https://react-bun-ssr.dev/framework-test",
      title: "Framework test routes",
    });

    initGoogleAnalytics();

    expect(windowValue.dataLayer).toHaveLength(0);
    expect(windowValue.__RBSSR_GA_INITIALIZED__).toBeUndefined();
  });

  it("does not emit page_view events for hidden framework test routes", () => {
    process.env.NODE_ENV = "production";
    const windowValue = setTestDom({
      href: "https://react-bun-ssr.dev/docs",
      title: "Docs",
    });

    initGoogleAnalytics();

    windowValue.location.href = "https://react-bun-ssr.dev/framework-test/deferred-reject";
    windowValue.location.pathname = "/framework-test/deferred-reject";
    windowValue.location.search = "";
    document.title = "Deferred rejection route";

    trackPageView(new URL(windowValue.location.href));

    expect(windowValue.dataLayer).toHaveLength(2);
    expect(windowValue.dataLayer.some((entry) => toCommand(entry)?.[0] === "event")).toBe(false);
  });
});
