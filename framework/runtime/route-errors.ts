import type { RouteErrorResponse } from "./types";

const ROUTE_ERROR_SYMBOL = Symbol.for("rbssr.route_error");
const REDIRECT_MIN = 300;
const REDIRECT_MAX = 399;

interface InternalRouteError {
  [ROUTE_ERROR_SYMBOL]: true;
  response: RouteErrorResponse;
}

function isRedirectStatus(status: number): boolean {
  return status >= REDIRECT_MIN && status <= REDIRECT_MAX;
}

function normalizeStatus(status: number): number {
  if (!Number.isFinite(status) || status < 100 || status > 599) {
    throw new Error("routeError(status, ...) requires an HTTP status between 100 and 599.");
  }
  return Math.trunc(status);
}

function defaultStatusText(status: number): string {
  try {
    return new Response(null, { status }).statusText || "Error";
  } catch {
    return "Error";
  }
}

function headersToRecord(headersInit?: HeadersInit): Record<string, string> | undefined {
  if (!headersInit) {
    return undefined;
  }
  const headers = new Headers(headersInit);
  const record: Record<string, string> = {};
  let count = 0;
  headers.forEach((value, key) => {
    record[key] = value;
    count += 1;
  });
  return count > 0 ? record : undefined;
}

export function createRouteErrorResponse(
  status: number,
  data?: unknown,
  init: {
    statusText?: string;
    headers?: HeadersInit;
  } = {},
): RouteErrorResponse {
  const normalizedStatus = normalizeStatus(status);
  return {
    type: "route_error",
    status: normalizedStatus,
    statusText: init.statusText ?? defaultStatusText(normalizedStatus),
    data,
    headers: headersToRecord(init.headers),
  };
}

function isInternalRouteError(value: unknown): value is InternalRouteError {
  return Boolean(
    value
      && typeof value === "object"
      && (value as Partial<InternalRouteError>)[ROUTE_ERROR_SYMBOL] === true
      && isRouteErrorResponse((value as Partial<InternalRouteError>).response),
  );
}

export function routeError(
  status: number,
  data?: unknown,
  init: {
    statusText?: string;
    headers?: HeadersInit;
  } = {},
): never {
  const response = createRouteErrorResponse(status, data, init);
  throw {
    [ROUTE_ERROR_SYMBOL]: true,
    response,
  } satisfies InternalRouteError;
}

export function notFound(data?: unknown): never {
  return routeError(404, data, { statusText: "Not Found" });
}

export function isRouteErrorResponse(value: unknown): value is RouteErrorResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<RouteErrorResponse>;
  return (
    candidate.type === "route_error"
    && typeof candidate.status === "number"
    && Number.isFinite(candidate.status)
    && typeof candidate.statusText === "string"
  );
}

export function toRouteErrorResponse(value: unknown): RouteErrorResponse | null {
  if (isInternalRouteError(value)) {
    return value.response;
  }

  if (isRouteErrorResponse(value)) {
    return value;
  }

  if (value instanceof Response) {
    if (isRedirectStatus(value.status)) {
      return null;
    }

    return createRouteErrorResponse(value.status, undefined, {
      statusText: value.statusText,
      headers: value.headers,
    });
  }

  return null;
}

export function sanitizeRouteErrorResponse(
  routeErrorResponse: RouteErrorResponse,
  production: boolean,
): RouteErrorResponse {
  if (!production || routeErrorResponse.status < 500) {
    return routeErrorResponse;
  }

  return {
    ...routeErrorResponse,
    statusText: "Internal Server Error",
    data: undefined,
  };
}

export function toRouteErrorHttpResponse(routeErrorResponse: RouteErrorResponse): Response {
  const headers = new Headers(routeErrorResponse.headers);
  const init = {
    status: routeErrorResponse.status,
    statusText: routeErrorResponse.statusText,
    headers,
  };

  if (routeErrorResponse.data === undefined || routeErrorResponse.data === null) {
    return new Response(null, init);
  }

  if (typeof routeErrorResponse.data === "string") {
    if (!headers.has("content-type")) {
      headers.set("content-type", "text/plain; charset=utf-8");
    }
    return new Response(routeErrorResponse.data, init);
  }

  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json; charset=utf-8");
  }
  return new Response(JSON.stringify(routeErrorResponse.data), init);
}
