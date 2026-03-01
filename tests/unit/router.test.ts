import { describe, expect, it } from "bun:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { useRouter, type Router } from "../../framework/runtime/router";

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
});
