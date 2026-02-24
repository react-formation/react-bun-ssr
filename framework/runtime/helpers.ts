import type { FrameworkConfig, RedirectResult } from "./types";

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

export function isRedirectResult(value: unknown): value is RedirectResult {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as RedirectResult).type === "redirect" &&
      typeof (value as RedirectResult).location === "string",
  );
}
