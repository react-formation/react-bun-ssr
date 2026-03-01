export const SITE_NAME = "react-bun-ssr";
export const DEFAULT_SITE_URL = "https://react-bun-ssr.fly.dev";

function normalizeSiteUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, "");
  new URL(normalized);
  return normalized;
}

function resolveSiteUrl(): string {
  if (typeof window !== "undefined" && window.location.origin) {
    return normalizeSiteUrl(window.location.origin);
  }

  if (typeof Bun !== "undefined") {
    const configured = Bun.env.RBSSR_SITE_URL ?? Bun.env.PUBLIC_SITE_URL;
    if (configured) {
      return normalizeSiteUrl(configured);
    }
  }

  return DEFAULT_SITE_URL;
}

export const SITE_URL = resolveSiteUrl();

export function toAbsoluteUrl(pathname: string): string {
  return new URL(pathname, SITE_URL).toString();
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
