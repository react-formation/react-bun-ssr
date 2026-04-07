import { describe, expect, it } from "bun:test";
import { createClientNavigationSession } from "../../../framework/runtime/client-navigation-session";
import type {
  ClientNavigationResult,
  ClientNavigationSessionDeps,
} from "../../../framework/runtime/client-navigation-session";
import type {
  TransitionDocumentChunk,
  TransitionInitialChunk,
  TransitionRedirectChunk,
} from "../../../framework/runtime/types";

type TransitionInitialResult = TransitionInitialChunk | TransitionRedirectChunk | TransitionDocumentChunk | null;

function createNavigationResult(to: string, options: Partial<ClientNavigationResult> = {}): ClientNavigationResult {
  const nextUrl = new URL(to);
  return {
    from: "/docs",
    to: nextUrl.pathname + nextUrl.search + nextUrl.hash,
    nextUrl,
    status: 200,
    kind: "page",
    redirected: false,
    prefetched: false,
    ...options,
  };
}

function createTestDeps(
  overrides: Partial<ClientNavigationSessionDeps> = {},
): {
  calls: string[];
  deps: ClientNavigationSessionDeps;
} {
  const calls: string[] = [];
  const deps: ClientNavigationSessionDeps = {
    state: {
      prefetchCache: new Map(),
      navigationToken: 0,
      transitionAbortController: null,
    },
    currentUrl: new URL("http://localhost/docs"),
    routerSnapshot: {
      pages: [
        {
          id: "guide",
          routePath: "/guide",
          segments: [
            {
              kind: "static",
              value: "guide",
            },
          ],
          score: 1,
        },
      ],
      assets: {
        guide: {
          script: "/route-guide.js",
          css: [],
        },
      },
    },
    protocol: {
      submitAction: async () => ({
        type: "data",
        status: 200,
        data: null,
      }),
      startTransition: () => {
        calls.push("startTransition");
        return {
          initialPromise: Promise.resolve({
            type: "initial",
            kind: "page",
            status: 200,
            payload: {
              routeId: "guide",
              loaderData: null,
              params: {},
              url: "http://localhost/guide",
            },
            head: "<title>Guide</title>",
            redirected: false,
          }),
          donePromise: Promise.resolve(),
        };
      },
    },
    loadRouteModule: async routeId => {
      calls.push(`load:${routeId}`);
    },
    renderLoading: input => {
      calls.push(`loading:${input.routeId}`);
    },
    renderInitial: async () => {
      calls.push("renderInitial");
      return createNavigationResult("http://localhost/guide");
    },
    hardNavigate: url => {
      calls.push(`hard:${url.toString()}`);
    },
    emitNavigation: () => {
      calls.push("emit");
    },
    ...overrides,
  };

  return {
    calls,
    deps,
  };
}

describe("client navigation session", () => {
  it("skips same-path navigations without starting a transition", async () => {
    const { calls, deps } = createTestDeps();
    const session = createClientNavigationSession(deps);

    const result = await session.navigate(new URL("http://localhost/docs"));

    expect(result).toBeNull();
    expect(calls).toEqual([]);
  });

  it("loads the matched route, renders loading, and completes a normal page transition", async () => {
    const { calls, deps } = createTestDeps();
    const session = createClientNavigationSession(deps);

    const result = await session.navigate(new URL("http://localhost/guide"));

    expect(result?.to).toBe("/guide");
    expect(calls).toEqual([
      "load:guide",
      "startTransition",
      "loading:guide",
      "renderInitial",
      "emit",
    ]);
  });

  it("reuses prefetched transition entries for navigation", async () => {
    const { calls, deps } = createTestDeps({
      renderInitial: async (_chunk, options) => {
        calls.push(`renderInitial:${options.prefetched}`);
        return createNavigationResult("http://localhost/guide", {
          prefetched: options.prefetched,
        });
      },
    });
    const session = createClientNavigationSession(deps);

    session.prefetch(new URL("http://localhost/guide"));
    const result = await session.navigate(new URL("http://localhost/guide"));

    expect(result?.prefetched).toBe(true);
    expect(calls).toEqual([
      "load:guide",
      "startTransition",
      "loading:guide",
      "renderInitial:true",
      "emit",
    ]);
  });

  it("aborts and ignores stale navigation results when a later navigation wins", async () => {
    const initialResolvers: Array<(value: TransitionInitialResult) => void> = [];
    const signals: AbortSignal[] = [];
    const { calls, deps } = createTestDeps({
      protocol: {
        submitAction: async () => ({
          type: "data",
          status: 200,
          data: null,
        }),
        startTransition: input => {
          calls.push(`startTransition:${new URL(input.to).toString()}`);
          if (input.signal) {
            signals.push(input.signal);
          }

          return {
            initialPromise: new Promise(resolve => {
              initialResolvers.push(resolve);
            }),
            donePromise: Promise.resolve(),
          };
        },
      },
      renderInitial: async chunk => {
        calls.push(`renderInitial:${chunk.payload.url}`);
        return createNavigationResult(chunk.payload.url);
      },
    });
    const session = createClientNavigationSession(deps);

    const firstNavigation = session.navigate(new URL("http://localhost/guide"));
    await Promise.resolve();
    const secondNavigation = session.navigate(new URL("http://localhost/guide?next=1"));
    await Promise.resolve();

    expect(signals[0]?.aborted).toBe(true);
    initialResolvers[0]?.({
      type: "initial",
      kind: "page",
      status: 200,
      payload: {
        routeId: "guide",
        loaderData: null,
        params: {},
        url: "http://localhost/guide",
      },
      head: "<title>Guide</title>",
      redirected: false,
    });
    initialResolvers[1]?.({
      type: "initial",
      kind: "page",
      status: 200,
      payload: {
        routeId: "guide",
        loaderData: null,
        params: {},
        url: "http://localhost/guide?next=1",
      },
      head: "<title>Guide</title>",
      redirected: false,
    });

    await expect(firstNavigation).resolves.toBeNull();
    await expect(secondNavigation).resolves.toMatchObject({
      to: "/guide?next=1",
    });
    expect(calls).toContain("renderInitial:http://localhost/guide?next=1");
    expect(calls).not.toContain("renderInitial:http://localhost/guide");
  });

  it("follows same-origin transition redirects through the session", async () => {
    const { calls, deps } = createTestDeps({
      protocol: {
        submitAction: async () => ({
          type: "data",
          status: 200,
          data: null,
        }),
        startTransition: input => {
          const target = new URL(input.to);
          calls.push(`startTransition:${target.pathname}${target.search}`);

          if (target.searchParams.get("redirected") === "1") {
            return {
              initialPromise: Promise.resolve({
                type: "initial",
                kind: "page",
                status: 200,
                payload: {
                  routeId: "guide",
                  loaderData: null,
                  params: {},
                  url: "http://localhost/guide?redirected=1",
                },
                head: "<title>Guide</title>",
                redirected: true,
              }),
              donePromise: Promise.resolve(),
            };
          }

          return {
            initialPromise: Promise.resolve({
              type: "redirect",
              location: "/guide?redirected=1",
              status: 302,
            }),
            donePromise: Promise.resolve(),
          };
        },
      },
      renderInitial: async (chunk, options) => {
        calls.push(`renderInitial:${chunk.payload.url}:${options.redirected}:${options.redirectDepth}:${options.replace}`);
        return createNavigationResult(chunk.payload.url, {
          redirected: options.redirected ?? false,
        });
      },
    });
    const session = createClientNavigationSession(deps);

    const result = await session.navigate(new URL("http://localhost/guide"));

    expect(result?.to).toBe("/guide?redirected=1");
    expect(calls).toContain("startTransition:/guide");
    expect(calls).toContain("startTransition:/guide?redirected=1");
    expect(calls).toContain("renderInitial:http://localhost/guide?redirected=1:true:1:true");
    expect(calls.some(call => call.startsWith("hard:"))).toBe(false);
  });

  it("hard-navigates when a transition does not provide an initial result", async () => {
    const { calls, deps } = createTestDeps({
      protocol: {
        submitAction: async () => ({
          type: "data",
          status: 200,
          data: null,
        }),
        startTransition: () => {
          calls.push("startTransition");
          return {
            initialPromise: Promise.resolve(null),
            donePromise: Promise.resolve(),
          };
        },
      },
    });
    const session = createClientNavigationSession(deps);

    const result = await session.navigate(new URL("http://localhost/guide"));

    expect(result).toBeNull();
    expect(calls).toContain("hard:http://localhost/guide");
  });

  it("matches and settles pending Navigation API transitions by framework info", async () => {
    const { deps } = createTestDeps({
      pendingState: {
        pendingNavigationTransitions: new Map(),
        navigationApiTransitionCounter: 0,
      },
      setTimeout: () => 1,
      clearTimeout: () => undefined,
    });
    const session = createClientNavigationSession(deps);

    const id = session.nextNavigationTransitionId();
    const pendingPromise = session.createPendingNavigationTransition({
      id,
      toUrl: new URL("http://localhost/guide"),
      replace: false,
      scroll: true,
    });
    const pending = session.findPendingTransitionForEvent({
      info: {
        __rbssrTransition: true,
        id,
      },
    });

    expect(pending?.id).toBe(id);
    session.settlePendingNavigationTransition(pending!, createNavigationResult("http://localhost/guide"));
    await expect(pendingPromise).resolves.toMatchObject({
      to: "/guide",
    });
    expect(deps.pendingState?.pendingNavigationTransitions.size).toBe(0);
  });

  it("matches pending Navigation API transitions by destination href", () => {
    const { deps } = createTestDeps({
      pendingState: {
        pendingNavigationTransitions: new Map(),
        navigationApiTransitionCounter: 0,
      },
      now: () => 1_000,
      setTimeout: () => 1,
      clearTimeout: () => undefined,
    });
    const session = createClientNavigationSession(deps);

    const id = session.nextNavigationTransitionId();
    void session.createPendingNavigationTransition({
      id,
      toUrl: new URL("http://localhost/guide"),
      replace: false,
      scroll: true,
    });

    const pending = session.findPendingTransitionForEvent({
      destination: {
        url: "/guide",
      },
    });
    const userInitiatedPending = session.findPendingTransitionForEvent({
      userInitiated: true,
      destination: {
        url: "/guide",
      },
    });

    expect(pending?.id).toBe(id);
    expect(userInitiatedPending).toBeNull();
  });

  it("falls back to an internal navigation when a pending Navigation API transition times out", async () => {
    const timer: {
      callback: (() => void) | null;
    } = {
      callback: null,
    };
    const { calls, deps } = createTestDeps({
      pendingState: {
        pendingNavigationTransitions: new Map(),
        navigationApiTransitionCounter: 0,
      },
      setTimeout: callback => {
        timer.callback = callback;
        return 1;
      },
      clearTimeout: () => undefined,
    });
    const session = createClientNavigationSession(deps);

    const id = session.nextNavigationTransitionId();
    const pendingPromise = session.createPendingNavigationTransition({
      id,
      toUrl: new URL("http://localhost/guide"),
      replace: false,
      scroll: true,
    });
    if (!timer.callback) {
      throw new Error("Expected pending navigation timeout to be registered.");
    }
    timer.callback();

    await expect(pendingPromise).resolves.toMatchObject({
      to: "/guide",
    });
    expect(calls).toEqual([
      "load:guide",
      "startTransition",
      "loading:guide",
      "renderInitial",
      "emit",
    ]);
    expect(deps.pendingState?.pendingNavigationTransitions.size).toBe(0);
  });
});
