import { describe, expect, it, mock } from "bun:test";
import {
  addNavigationNavigateListener,
  canNavigationBack,
  canNavigationForward,
  canNavigationNavigateWithIntercept,
  canNavigationReload,
  dispatchNavigationNavigate,
  goBack,
  goForward,
  hasNavigationApi,
  reloadPage,
  type NavigationDispatchOptions,
} from "../../framework/runtime/navigation-api";

interface WindowMock {
  navigation?: {
    back?: () => unknown;
    forward?: () => unknown;
    reload?: () => unknown;
    navigate?: (url: string, options?: NavigationDispatchOptions) => unknown;
    addEventListener?: (type: string, listener: (event: unknown) => void) => void;
    removeEventListener?: (type: string, listener: (event: unknown) => void) => void;
  };
  history: {
    back: () => void;
    forward: () => void;
  };
  location: {
    reload: () => void;
  };
}

function withWindowMock(windowMock: WindowMock | undefined, callback: () => void | Promise<void>): Promise<void> {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");

  if (windowMock) {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: windowMock,
    });
  } else {
    delete (globalThis as { window?: unknown }).window;
  }

  const restore = () => {
    if (descriptor) {
      Object.defineProperty(globalThis, "window", descriptor);
      return;
    }
    delete (globalThis as { window?: unknown }).window;
  };

  const result = callback();
  if (result && typeof (result as Promise<void>).then === "function") {
    return (result as Promise<void>).finally(restore);
  }

  restore();
  return Promise.resolve();
}

function withNavigateEventMock(
  navigateEventCtor: unknown,
  callback: () => void | Promise<void>,
): Promise<void> {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "NavigateEvent");

  if (navigateEventCtor) {
    Object.defineProperty(globalThis, "NavigateEvent", {
      configurable: true,
      writable: true,
      value: navigateEventCtor,
    });
  } else {
    delete (globalThis as { NavigateEvent?: unknown }).NavigateEvent;
  }

  const restore = () => {
    if (descriptor) {
      Object.defineProperty(globalThis, "NavigateEvent", descriptor);
      return;
    }
    delete (globalThis as { NavigateEvent?: unknown }).NavigateEvent;
  };

  const result = callback();
  if (result && typeof (result as Promise<void>).then === "function") {
    return (result as Promise<void>).finally(restore);
  }

  restore();
  return Promise.resolve();
}

function createNavigateEventCtor(hasIntercept: boolean): unknown {
  class NavigateEventMock {}

  if (hasIntercept) {
    (NavigateEventMock.prototype as { intercept?: () => void }).intercept = () => undefined;
  }

  return NavigateEventMock;
}

function createBaseWindowMock(): WindowMock {
  return {
    history: {
      back: () => undefined,
      forward: () => undefined,
    },
    location: {
      reload: () => undefined,
    },
  };
}

describe("navigation-api adapter", () => {
  it("detects capabilities when navigation API is missing", async () => {
    await withWindowMock(undefined, () => {
      expect(hasNavigationApi()).toBe(false);
      expect(canNavigationBack()).toBe(false);
      expect(canNavigationForward()).toBe(false);
      expect(canNavigationReload()).toBe(false);
      expect(canNavigationNavigateWithIntercept()).toBe(false);
    });
  });

  it("detects capabilities when navigation API methods exist", async () => {
    await withWindowMock(
      {
        ...createBaseWindowMock(),
        navigation: {
          back: () => undefined,
          forward: () => undefined,
          reload: () => undefined,
        },
      },
      () => {
        expect(hasNavigationApi()).toBe(true);
        expect(canNavigationBack()).toBe(true);
        expect(canNavigationForward()).toBe(true);
        expect(canNavigationReload()).toBe(true);
      },
    );
  });

  it("detects navigate+intercept capability only when fully supported", async () => {
    const navigation = {
      navigate: () => ({ committed: Promise.resolve() }),
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    };

    await withNavigateEventMock(createNavigateEventCtor(true), async () => {
      await withWindowMock(
        {
          ...createBaseWindowMock(),
          navigation,
        },
        () => {
          expect(canNavigationNavigateWithIntercept()).toBe(true);
        },
      );
    });

    await withNavigateEventMock(createNavigateEventCtor(false), async () => {
      await withWindowMock(
        {
          ...createBaseWindowMock(),
          navigation,
        },
        () => {
          expect(canNavigationNavigateWithIntercept()).toBe(false);
        },
      );
    });
  });

  it("falls back to history/location when navigation API is absent", async () => {
    const backSpy = mock(() => undefined);
    const forwardSpy = mock(() => undefined);
    const reloadSpy = mock(() => undefined);

    await withWindowMock(
      {
        history: { back: backSpy, forward: forwardSpy },
        location: { reload: reloadSpy },
      },
      () => {
        goBack();
        goForward();
        reloadPage();
      },
    );

    expect(backSpy).toHaveBeenCalledTimes(1);
    expect(forwardSpy).toHaveBeenCalledTimes(1);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("uses navigation API methods when available", async () => {
    const backSpy = mock(() => undefined);
    const forwardSpy = mock(() => undefined);
    const reloadSpy = mock(() => undefined);
    const historyBackSpy = mock(() => undefined);
    const historyForwardSpy = mock(() => undefined);
    const locationReloadSpy = mock(() => undefined);

    await withWindowMock(
      {
        navigation: {
          back: backSpy,
          forward: forwardSpy,
          reload: reloadSpy,
        },
        history: { back: historyBackSpy, forward: historyForwardSpy },
        location: { reload: locationReloadSpy },
      },
      () => {
        goBack();
        goForward();
        reloadPage();
      },
    );

    expect(backSpy).toHaveBeenCalledTimes(1);
    expect(forwardSpy).toHaveBeenCalledTimes(1);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(historyBackSpy).toHaveBeenCalledTimes(0);
    expect(historyForwardSpy).toHaveBeenCalledTimes(0);
    expect(locationReloadSpy).toHaveBeenCalledTimes(0);
  });

  it("falls back when navigation methods throw", async () => {
    const backFallbackSpy = mock(() => undefined);
    const forwardFallbackSpy = mock(() => undefined);
    const reloadFallbackSpy = mock(() => undefined);

    await withWindowMock(
      {
        navigation: {
          back: () => {
            throw new Error("boom");
          },
          forward: () => {
            throw new Error("boom");
          },
          reload: () => {
            throw new Error("boom");
          },
        },
        history: { back: backFallbackSpy, forward: forwardFallbackSpy },
        location: { reload: reloadFallbackSpy },
      },
      () => {
        goBack();
        goForward();
        reloadPage();
      },
    );

    expect(backFallbackSpy).toHaveBeenCalledTimes(1);
    expect(forwardFallbackSpy).toHaveBeenCalledTimes(1);
    expect(reloadFallbackSpy).toHaveBeenCalledTimes(1);
  });

  it("falls back when navigation methods reject asynchronously", async () => {
    const backFallbackSpy = mock(() => undefined);
    const forwardFallbackSpy = mock(() => undefined);
    const reloadFallbackSpy = mock(() => undefined);

    await withWindowMock(
      {
        navigation: {
          back: () => Promise.reject(new Error("reject")),
          forward: () => Promise.reject(new Error("reject")),
          reload: () => Promise.reject(new Error("reject")),
        },
        history: { back: backFallbackSpy, forward: forwardFallbackSpy },
        location: { reload: reloadFallbackSpy },
      },
      async () => {
        goBack();
        goForward();
        reloadPage();
        await new Promise(resolve => setTimeout(resolve, 0));
      },
    );

    expect(backFallbackSpy).toHaveBeenCalledTimes(1);
    expect(forwardFallbackSpy).toHaveBeenCalledTimes(1);
    expect(reloadFallbackSpy).toHaveBeenCalledTimes(1);
  });

  it("dispatches navigation.navigate with history and info when available", async () => {
    const navigateSpy = mock(() => ({
      committed: Promise.resolve(),
    }));

    await withWindowMock(
      {
        ...createBaseWindowMock(),
        navigation: {
          navigate: navigateSpy,
        },
      },
      async () => {
        const result = dispatchNavigationNavigate("http://localhost/docs", {
          history: "push",
          info: { requestId: "123" },
        });
        expect(result.dispatched).toBe(true);
        expect(await result.committed).toBe(true);
      },
    );

    expect(navigateSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith("http://localhost/docs", {
      history: "push",
      info: { requestId: "123" },
    });
  });

  it("reports unsuccessful dispatch when navigation.navigate is missing", async () => {
    await withWindowMock(createBaseWindowMock(), () => {
      const result = dispatchNavigationNavigate("http://localhost/docs", {
        history: "replace",
      });
      expect(result.dispatched).toBe(false);
      expect(result.committed).toBeNull();
    });
  });

  it("exposes committed outcome as false when navigation commit rejects", async () => {
    await withWindowMock(
      {
        ...createBaseWindowMock(),
        navigation: {
          navigate: () => ({
            committed: Promise.reject(new Error("nope")),
          }),
        },
      },
      async () => {
        const result = dispatchNavigationNavigate("http://localhost/docs", {
          history: "push",
        });
        expect(result.dispatched).toBe(true);
        expect(await result.committed).toBe(false);
      },
    );
  });

  it("registers and unregisters navigate listeners when available", async () => {
    let capturedListener: ((event: unknown) => void) | null = null;
    const addEventListenerSpy = mock((type: string, listener: (event: unknown) => void) => {
      if (type === "navigate") {
        capturedListener = listener;
      }
    });
    const removeEventListenerSpy = mock((type: string, listener: (event: unknown) => void) => {
      expect(type).toBe("navigate");
      expect(capturedListener).not.toBeNull();
      expect(listener).toBe(capturedListener as (event: unknown) => void);
    });
    const listenerSpy = mock(() => undefined);

    await withWindowMock(
      {
        ...createBaseWindowMock(),
        navigation: {
          addEventListener: addEventListenerSpy,
          removeEventListener: removeEventListenerSpy,
        },
      },
      () => {
        const unsubscribe = addNavigationNavigateListener(listenerSpy);
        expect(typeof unsubscribe).toBe("function");
        expect(addEventListenerSpy).toHaveBeenCalledTimes(1);

        capturedListener?.({ test: true });
        expect(listenerSpy).toHaveBeenCalledTimes(1);

        unsubscribe?.();
        expect(removeEventListenerSpy).toHaveBeenCalledTimes(1);
      },
    );
  });
});
