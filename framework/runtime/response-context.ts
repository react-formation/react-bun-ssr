import type { ResponseContext, ResponseCookieOptions, ResponseCookies } from "./types";

type HeaderOperation =
  | { type: "set"; name: string; value: string }
  | { type: "append"; name: string; value: string }
  | { type: "delete"; name: string };

interface ResponseContextState {
  requestCookies: Map<string, string>;
  pendingCookies: Map<string, string | undefined>;
  headerOperations: HeaderOperation[];
  headerPreview: Headers;
}

const responseContextState = new WeakMap<ResponseContext, ResponseContextState>();

function toHeaderName(name: string): string {
  return String(name).trim();
}

function toCookieDate(value: Date | string): string {
  if (value instanceof Date) {
    return value.toUTCString();
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.valueOf())) {
    return parsed.toUTCString();
  }

  return value;
}

function normalizeSameSite(value: ResponseCookieOptions["sameSite"]): "Strict" | "Lax" | "None" | null {
  if (!value) {
    return null;
  }

  const lowered = value.toLowerCase();
  if (lowered === "strict") {
    return "Strict";
  }
  if (lowered === "lax") {
    return "Lax";
  }
  if (lowered === "none") {
    return "None";
  }

  return null;
}

function serializeCookie(name: string, value: string, options: ResponseCookieOptions = {}): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.path) {
    parts.push(`Path=${options.path}`);
  }
  if (options.domain) {
    parts.push(`Domain=${options.domain}`);
  }
  if (typeof options.maxAge === "number" && Number.isFinite(options.maxAge)) {
    parts.push(`Max-Age=${Math.trunc(options.maxAge)}`);
  }
  if (options.expires) {
    parts.push(`Expires=${toCookieDate(options.expires)}`);
  }
  if (options.httpOnly) {
    parts.push("HttpOnly");
  }
  if (options.secure) {
    parts.push("Secure");
  }
  const sameSite = normalizeSameSite(options.sameSite);
  if (sameSite) {
    parts.push(`SameSite=${sameSite}`);
  }

  return parts.join("; ");
}

function serializeDeleteCookie(
  name: string,
  options: Omit<ResponseCookieOptions, "expires" | "maxAge"> = {},
): string {
  return serializeCookie(name, "", {
    ...options,
    maxAge: 0,
    expires: new Date(0),
  });
}

function createMutableHeaders(state: ResponseContextState): ResponseContext["headers"] {
  return {
    set(name, value) {
      const normalizedName = toHeaderName(name);
      state.headerOperations.push({
        type: "set",
        name: normalizedName,
        value: String(value),
      });
      state.headerPreview.set(normalizedName, String(value));
    },
    append(name, value) {
      const normalizedName = toHeaderName(name);
      state.headerOperations.push({
        type: "append",
        name: normalizedName,
        value: String(value),
      });
      state.headerPreview.append(normalizedName, String(value));
    },
    delete(name) {
      const normalizedName = toHeaderName(name);
      state.headerOperations.push({
        type: "delete",
        name: normalizedName,
      });
      state.headerPreview.delete(normalizedName);
    },
    get(name) {
      return state.headerPreview.get(toHeaderName(name));
    },
    has(name) {
      return state.headerPreview.has(toHeaderName(name));
    },
  };
}

class MutableResponseCookies implements ResponseCookies {
  constructor(private readonly state: ResponseContextState) {}

  get(name: string): string | undefined {
    if (this.state.pendingCookies.has(name)) {
      return this.state.pendingCookies.get(name);
    }

    return this.state.requestCookies.get(name);
  }

  set(name: string, value: string, options: ResponseCookieOptions = {}): void {
    const serialized = serializeCookie(name, value, options);
    this.state.pendingCookies.set(name, value);
    this.state.headerOperations.push({
      type: "append",
      name: "set-cookie",
      value: serialized,
    });
    this.state.headerPreview.append("set-cookie", serialized);
  }

  delete(name: string, options: Omit<ResponseCookieOptions, "expires" | "maxAge"> = {}): void {
    const serialized = serializeDeleteCookie(name, options);
    this.state.pendingCookies.set(name, undefined);
    this.state.headerOperations.push({
      type: "append",
      name: "set-cookie",
      value: serialized,
    });
    this.state.headerPreview.append("set-cookie", serialized);
  }
}

export function createResponseContext(requestCookies: Map<string, string>): ResponseContext {
  const state: ResponseContextState = {
    requestCookies,
    pendingCookies: new Map(),
    headerOperations: [],
    headerPreview: new Headers(),
  };

  const context: ResponseContext = {
    headers: createMutableHeaders(state),
    cookies: new MutableResponseCookies(state),
  };

  responseContextState.set(context, state);
  return context;
}

export function applyResponseContext(response: Response, context: ResponseContext): Response {
  const state = responseContextState.get(context);
  if (!state || state.headerOperations.length === 0) {
    return response;
  }

  const headers = new Headers(response.headers);
  for (const operation of state.headerOperations) {
    if (operation.type === "set") {
      headers.set(operation.name, operation.value);
      continue;
    }
    if (operation.type === "append") {
      headers.append(operation.name, operation.value);
      continue;
    }

    headers.delete(operation.name);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
