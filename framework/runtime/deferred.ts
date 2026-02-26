import type { DeferredLoaderResult, DeferredToken } from "./types";

interface ThenableLike {
  then: (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => unknown;
}

export interface DeferredSettleEntry {
  id: string;
  settled: Promise<
    | { ok: true; value: unknown }
    | { ok: false; error: string }
  >;
}

export interface PreparedDeferredPayload {
  dataForRender: Record<string, unknown>;
  dataForPayload: Record<string, unknown>;
  settleEntries: DeferredSettleEntry[];
}

const DEFERRED_TYPE = "defer";
const DEFERRED_TOKEN_KEY = "__rbssrDeferred";

let deferredCounter = 0;

function nextDeferredId(routeId: string, key: string): string {
  deferredCounter += 1;
  return `${routeId}:${key}:${deferredCounter}`;
}

function isThenable(value: unknown): value is ThenableLike {
  return Boolean(
    value &&
      (typeof value === "object" || typeof value === "function") &&
      typeof (value as ThenableLike).then === "function",
  );
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function defer<T extends Record<string, unknown>>(data: T): DeferredLoaderResult<T> {
  if (!data || Array.isArray(data) || typeof data !== "object") {
    throw new Error("defer() expects an object with top-level keys.");
  }

  return {
    __rbssrType: DEFERRED_TYPE,
    data,
  };
}

export function isDeferredLoaderResult(value: unknown): value is DeferredLoaderResult<Record<string, unknown>> {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as DeferredLoaderResult<Record<string, unknown>>).__rbssrType === DEFERRED_TYPE &&
      (value as DeferredLoaderResult<Record<string, unknown>>).data &&
      !Array.isArray((value as DeferredLoaderResult<Record<string, unknown>>).data) &&
      typeof (value as DeferredLoaderResult<Record<string, unknown>>).data === "object",
  );
}

export function isDeferredToken(value: unknown): value is DeferredToken {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as DeferredToken)[DEFERRED_TOKEN_KEY] === "string",
  );
}

export function createDeferredToken(id: string): DeferredToken {
  return {
    [DEFERRED_TOKEN_KEY]: id,
  };
}

export function prepareDeferredPayload(
  routeId: string,
  deferredValue: DeferredLoaderResult<Record<string, unknown>>,
): PreparedDeferredPayload {
  const dataForRender: Record<string, unknown> = {};
  const dataForPayload: Record<string, unknown> = {};
  const settleEntries: DeferredSettleEntry[] = [];

  for (const [key, value] of Object.entries(deferredValue.data)) {
    if (!isThenable(value)) {
      dataForRender[key] = value;
      dataForPayload[key] = value;
      continue;
    }

    const id = nextDeferredId(routeId, key);
    const promise = Promise.resolve(value);
    dataForRender[key] = promise;
    dataForPayload[key] = createDeferredToken(id);
    settleEntries.push({
      id,
      settled: promise.then(
        resolved => ({ ok: true as const, value: resolved }),
        error => ({ ok: false as const, error: toErrorMessage(error) }),
      ),
    });
  }

  return {
    dataForRender,
    dataForPayload,
    settleEntries,
  };
}
