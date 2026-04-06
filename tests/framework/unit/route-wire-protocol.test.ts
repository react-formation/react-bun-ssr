import { describe, expect, it } from "bun:test";
import {
  applyRouteWireDeferredChunk,
  completeRouteWireTransition,
  createRouteWireProtocol,
  reviveRouteWirePayload,
  resolveRouteWireTransitionInitial,
} from "../../../framework/runtime/route-wire-protocol";
import type { TransitionDeferredChunk } from "../../../framework/runtime/types";

describe("route wire protocol", () => {
  it("posts action submissions to the internal endpoint and normalizes data outcomes", async () => {
    let requestedUrl = "";
    let requestedMethod = "";

    const protocol = createRouteWireProtocol({
      getCurrentUrl: () => new URL("http://localhost/form?tab=1#section"),
      fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
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
      }) as typeof fetch,
    });

    const result = await protocol.submitAction({
      to: "/form?tab=1#section",
      formData: new FormData(),
    });

    expect(requestedMethod).toBe("POST");
    expect(requestedUrl).toBe("http://localhost/__rbssr/action?to=%2Fform%3Ftab%3D1%23section");
    expect(result).toEqual({
      type: "data",
      status: 200,
      data: { ok: true },
    });
  });

  it("starts transition requests and surfaces the initial chunk plus deferred follow-ups", async () => {
    const deferredChunks: TransitionDeferredChunk[] = [];
    let requestedUrl = "";

    const encoder = new TextEncoder();
    const protocol = createRouteWireProtocol({
      getCurrentUrl: () => new URL("http://localhost/current"),
      fetchImpl: (async (input: RequestInfo | URL) => {
        requestedUrl = String(input);

        return new Response(new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(
              '{"type":"initial","kind":"page","status":200,"payload":{"routeId":"docs","loaderData":{"slow":{"__rbssrDeferred":"slow:1"}},"params":{},"url":"http://localhost/docs"},"head":"<title>Docs</title>","redirected":false}\n{"type":"de',
            ));
            controller.enqueue(encoder.encode(
              'ferred","id":"slow:1","ok":true,"value":"done"}\n',
            ));
            controller.close();
          },
        }), {
          status: 200,
          headers: {
            "content-type": "application/x-ndjson",
          },
        });
      }) as typeof fetch,
    });

    const transition = protocol.startTransition({
      to: "/docs",
      onDeferredChunk: chunk => {
        deferredChunks.push(chunk);
      },
    });

    expect(requestedUrl).toBe("http://localhost/__rbssr/transition?to=%2Fdocs");
    await expect(transition.initialPromise).resolves.toEqual({
      type: "initial",
      kind: "page",
      status: 200,
      payload: {
        routeId: "docs",
        loaderData: {
          slow: {
            __rbssrDeferred: "slow:1",
          },
        },
        params: {},
        url: "http://localhost/docs",
      },
      head: "<title>Docs</title>",
      redirected: false,
    });
    await transition.donePromise;

    expect(deferredChunks).toEqual([
      {
        type: "deferred",
        id: "slow:1",
        ok: true,
        value: "done",
      },
    ]);
  });

  it("revives deferred loader tokens through the supplied deferred runtime", () => {
    const slowValue = Promise.resolve("done");

    const revived = reviveRouteWirePayload({
      routeId: "docs",
      loaderData: {
        slow: {
          __rbssrDeferred: "slow:1",
        },
        ready: "now",
      },
      params: {},
      url: "http://localhost/docs",
    }, {
      get(id) {
        expect(id).toBe("slow:1");
        return slowValue;
      },
    });

    expect(revived.loaderData).toEqual({
      slow: slowValue,
      ready: "now",
    });
  });

  it("applies deferred chunks to the supplied deferred runtime", () => {
    const settled: Array<Record<string, unknown>> = [];

    applyRouteWireDeferredChunk({
      type: "deferred",
      id: "slow:1",
      ok: true,
      value: "done",
    }, {
      resolve(id, value) {
        settled.push({
          type: "resolve",
          id,
          value,
        });
      },
      reject(id, message) {
        settled.push({
          type: "reject",
          id,
          message,
        });
      },
    });

    applyRouteWireDeferredChunk({
      type: "deferred",
      id: "slow:2",
      ok: false,
      error: "boom",
    }, {
      resolve(id, value) {
        settled.push({
          type: "resolve",
          id,
          value,
        });
      },
      reject(id, message) {
        settled.push({
          type: "reject",
          id,
          message,
        });
      },
    });

    expect(settled).toEqual([
      {
        type: "resolve",
        id: "slow:1",
        value: "done",
      },
      {
        type: "reject",
        id: "slow:2",
        message: "boom",
      },
    ]);
  });

  it("normalizes same-origin transition redirects into soft navigation plans", () => {
    const outcome = resolveRouteWireTransitionInitial({
      type: "redirect",
      location: "/docs/next?tab=2",
      status: 302,
    }, {
      currentUrl: new URL("http://localhost/docs"),
      redirectDepth: 0,
    });

    expect(outcome).toEqual({
      type: "navigate",
      navigation: {
        kind: "soft",
        location: "http://localhost/docs/next?tab=2",
        replace: true,
      },
      redirected: true,
      redirectDepth: 1,
    });
  });

  it("normalizes document transition fallbacks into hard navigation plans", () => {
    const outcome = resolveRouteWireTransitionInitial({
      type: "document",
      location: "http://localhost/plain",
      status: 202,
    }, {
      currentUrl: new URL("http://localhost/docs"),
    });

    expect(outcome).toEqual({
      type: "navigate",
      navigation: {
        kind: "hard",
        location: "http://localhost/plain",
        replace: true,
      },
      redirected: false,
      redirectDepth: 0,
    });
  });

  it("hardens transition redirects when the redirect depth limit is exceeded", () => {
    const outcome = resolveRouteWireTransitionInitial({
      type: "redirect",
      location: "/docs/final",
      status: 302,
    }, {
      currentUrl: new URL("http://localhost/docs"),
      redirectDepth: 8,
    });

    expect(outcome).toEqual({
      type: "navigate",
      navigation: {
        kind: "hard",
        location: "http://localhost/docs/final",
        replace: true,
      },
      redirected: true,
      redirectDepth: 9,
    });
  });

  it("completes same-origin transition redirects through the supplied soft navigation callback", async () => {
    const steps: string[] = [];

    const result = await completeRouteWireTransition({
      type: "redirect",
      location: "/docs/final",
      status: 302,
    }, {
      currentUrl: new URL("http://localhost/docs"),
      render: async () => {
        steps.push("render");
        return "rendered";
      },
      softNavigate: async (location, options) => {
        steps.push(`soft:${location}:${options.redirectDepth}:${options.redirected}`);
        return "navigated";
      },
      hardNavigate: location => {
        steps.push(`hard:${location}`);
      },
    });

    expect(result).toBe("navigated");
    expect(steps).toEqual([
      "soft:http://localhost/docs/final:1:true",
    ]);
  });
});
