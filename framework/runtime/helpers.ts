import type { FrameworkConfig, RedirectResult, RequestContext } from "./types";
import { defer as deferValue } from "./deferred";
import { routeError } from "./route-errors";

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json; charset=utf-8");
  }

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

export function redirect(
  location: string,
  status: RedirectResult["status"] = 302,
): RedirectResult {
  return {
    type: "redirect",
    location,
    status,
  };
}

export function defineConfig(config: FrameworkConfig): FrameworkConfig {
  return config;
}

export const defer = deferValue;

function toNormalizedFallback(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "/";
  }
  if (trimmed.startsWith("/")) {
    return trimmed.startsWith("//") ? "/" : trimmed;
  }
  if (trimmed.startsWith("?") || trimmed.startsWith("#")) {
    return `/${trimmed}`;
  }
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) {
    return "/";
  }
  return `/${trimmed.replace(/^\/+/, "")}`;
}

export function sanitizeRedirectTarget(value: string | null | undefined, fallback = "/"): string {
  const normalizedFallback = toNormalizedFallback(fallback);
  if (typeof value !== "string") {
    return normalizedFallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return normalizedFallback;
  }

  if (trimmed.startsWith("//") || trimmed.startsWith("\\\\")) {
    return normalizedFallback;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed, "http://rbssr.local");
  } catch {
    return normalizedFallback;
  }

  if (parsed.origin !== "http://rbssr.local") {
    return normalizedFallback;
  }

  const normalizedTarget = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  if (!normalizedTarget.startsWith("/")) {
    return normalizedFallback;
  }

  return normalizedTarget;
}

export function assertSameOriginAction(ctx: Pick<RequestContext, "request" | "url">): void {
  if (ctx.request.method.toUpperCase() === "GET" || ctx.request.method.toUpperCase() === "HEAD") {
    return;
  }

  const originHeader = ctx.request.headers.get("origin");
  if (!originHeader) {
    return;
  }

  let origin: URL;
  try {
    origin = new URL(originHeader);
  } catch {
    throw routeError(403, { message: "Invalid Origin header." });
  }

  if (origin.origin !== ctx.url.origin) {
    throw routeError(403, { message: "Cross-origin form submissions are not allowed." });
  }
}

export function isRedirectResult(value: unknown): value is RedirectResult {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as RedirectResult).type === "redirect" &&
      typeof (value as RedirectResult).location === "string",
  );
}
