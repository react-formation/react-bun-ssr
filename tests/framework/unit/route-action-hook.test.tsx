import { afterEach, describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";
import { Outlet, createPageAppTree, createRouteAction, useRouteAction } from "../../../framework/runtime/tree";
import type { RouteModuleBundle } from "../../../framework/runtime/types";

const originalFetch = globalThis.fetch;
const globalScope = globalThis as typeof globalThis & { window?: Window };
const originalWindow = globalScope.window;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalWindow) {
    globalScope.window = originalWindow;
  } else {
    Reflect.deleteProperty(globalScope, "window");
  }
});

function captureRouteAction<TState = unknown>(
  url = "http://localhost/form",
): (previousState: TState, formData: FormData) => Promise<TState> {
  let captured: ((previousState: TState, formData: FormData) => Promise<TState>) | null = null;
  const modules: RouteModuleBundle = {
    root: {
      default: () => <Outlet />,
    },
    layouts: [],
    route: {
      default: () => {
        captured = useRouteAction<TState>();
        return <h1>form</h1>;
      },
    },
  };

  renderToString(createPageAppTree(modules, {
    routeId: "form",
    loaderData: null,
    params: {},
    url,
  }));

  if (!captured) {
    throw new Error("Failed to capture useRouteAction callback.");
  }
  return captured as (previousState: TState, formData: FormData) => Promise<TState>;
}

function setWindowHref(href: string): void {
  const parsed = new URL(href);
  globalScope.window = {
    location: {
      href,
      origin: parsed.origin,
      pathname: parsed.pathname,
      search: parsed.search,
      hash: parsed.hash,
      assign: () => undefined,
    },
  } as unknown as Window & typeof globalThis;
}

describe("createRouteAction", () => {
  it("posts to the internal action endpoint using the current window location", async () => {
    setWindowHref("http://localhost/form?tab=1#section");

    let requestedUrl = "";
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({
        type: "data",
        status: 200,
        data: { ok: true },
      }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    }) as unknown as typeof fetch;

    const action = createRouteAction<{ ok: boolean }>();
    const result = await action({ ok: false }, new FormData());

    expect(requestedUrl).toBe("http://localhost/__rbssr/action?to=%2Fform%3Ftab%3D1%23section");
    expect(result).toEqual({ ok: true });
  });
});

describe("useRouteAction", () => {
  it("posts to the internal action endpoint and returns data payloads", async () => {
    setWindowHref("http://localhost/form?tab=1");

    let requestedUrl = "";
    let requestedMethod = "";
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      requestedUrl = String(input);
      requestedMethod = String(init?.method ?? "GET");
      return new Response(JSON.stringify({
        type: "data",
        status: 200,
        data: { ok: true },
      }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    }) as unknown as typeof fetch;

    const routeAction = captureRouteAction<{ ok: boolean }>("http://localhost/form?tab=1");
    const result = await routeAction({ ok: false }, new FormData());

    expect(requestedMethod).toBe("POST");
    expect(requestedUrl).toBe("http://localhost/__rbssr/action?to=%2Fform%3Ftab%3D1");
    expect(result).toEqual({ ok: true });
  });

  it("hard-navigates for cross-origin redirects and preserves previous state", async () => {
    let assignedHref = "";
    globalScope.window = {
      location: {
        href: "http://localhost/form",
        origin: "http://localhost",
        assign: (href: string) => {
          assignedHref = href;
        },
      },
    } as unknown as Window & typeof globalThis;

    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({
        type: "redirect",
        status: 302,
        location: "https://example.com/signed-out",
      }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    }) as unknown as typeof fetch;

    const routeAction = captureRouteAction<{ done: boolean }>();
    const previousState = { done: false };
    const result = await routeAction(previousState, new FormData());

    expect(assignedHref).toBe("https://example.com/signed-out");
    expect(result).toBe(previousState);
  });

  it("throws caught route envelopes", async () => {
    setWindowHref("http://localhost/form");

    const caughtError = {
      type: "route_error",
      status: 403,
      statusText: "Forbidden",
      data: { reason: "blocked" },
    };
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({
        type: "catch",
        status: 403,
        error: caughtError,
      }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    }) as unknown as typeof fetch;

    const routeAction = captureRouteAction<{ ok: boolean }>();
    await expect(routeAction({ ok: true }, new FormData())).rejects.toEqual(caughtError);
  });

  it("throws uncaught action errors", async () => {
    setWindowHref("http://localhost/form");

    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({
        type: "error",
        status: 500,
        message: "action boom",
      }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    }) as unknown as typeof fetch;

    const routeAction = captureRouteAction<{ ok: boolean }>();
    await expect(routeAction({ ok: true }, new FormData())).rejects.toThrow("action boom");
  });
});
