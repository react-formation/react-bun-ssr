export const SITE_NAME = "react-bun-ssr";
export const SITE_URL = "https://react-bun-ssr.fly.dev";

export function toAbsoluteUrl(pathname: string): string {
  return new URL(pathname, SITE_URL).toString();
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
