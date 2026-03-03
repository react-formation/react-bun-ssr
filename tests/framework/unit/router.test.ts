import { describe, expect, it, mock } from "bun:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import {
  notifyRouterNavigateListeners,
  useRouter,
  type Router,
} from "../../../framework/runtime/router";

function captureRouterFromRender(): Router {
  let captured: Router | null = null;

  function CaptureRouter() {
    captured = useRouter();
    return null;
  }

  renderToString(createElement(CaptureRouter));

  if (!captured) {
    throw new Error("Failed to capture router instance.");
  }

  return captured;
}

describe("useRouter", () => {
  it("returns a router object with next-style methods", () => {
    const router = captureRouterFromRender();
    expect(typeof router.push).toBe("function");
    expect(typeof router.replace).toBe("function");
    expect(typeof router.prefetch).toBe("function");
    expect(typeof router.back).toBe("function");
    expect(typeof router.forward).toBe("function");
    expect(typeof router.refresh).toBe("function");
    expect(typeof router.onNavigate).toBe("function");
  });

  it("is server-safe when invoked during SSR", () => {
    const router = captureRouterFromRender();

    expect(() => router.push("/docs/data/loaders")).not.toThrow();
    expect(() => router.replace("/docs/data/actions")).not.toThrow();
    expect(() => router.prefetch("/docs/start/overview")).not.toThrow();
    expect(() => router.back()).not.toThrow();
    expect(() => router.forward()).not.toThrow();
    expect(() => router.refresh()).not.toThrow();
  });

  it("accepts route-change listener registration during SSR without throwing", () => {
    let captured: Router | null = null;

    function CaptureRouter() {
      captured = useRouter();
      captured.onNavigate((nextUrl) => {
        void nextUrl;
      });
      return null;
    }

    expect(() => renderToString(createElement(CaptureRouter))).not.toThrow();
    expect(captured).not.toBeNull();
  });

  it("notifies listeners with the resolved next URL", () => {
    const firstListener = mock(() => undefined);
    const secondListener = mock(() => undefined);
    const nextUrl = new URL("https://react-bun-ssr.dev/docs/start/overview");

    notifyRouterNavigateListeners([firstListener, secondListener], nextUrl);

    expect(firstListener).toHaveBeenCalledWith(nextUrl);
    expect(secondListener).toHaveBeenCalledWith(nextUrl);
  });

  it("keeps notifying later listeners when one throws", () => {
    const error = new Error("boom");
    const warnSpy = mock(() => undefined);
    const secondListener = mock(() => undefined);
    const previousWarn = console.warn;
    console.warn = warnSpy;

    try {
      notifyRouterNavigateListeners(
        [
          () => {
            throw error;
          },
          secondListener,
        ],
        new URL("https://react-bun-ssr.dev/docs"),
      );
    } finally {
      console.warn = previousWarn;
    }

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(secondListener).toHaveBeenCalledTimes(1);
  });
});
