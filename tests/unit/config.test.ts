import { describe, expect, it } from "bun:test";
import { resolveConfig } from "../../framework/runtime/config";

describe("resolveConfig response header rules", () => {
  it("compiles glob sources to matchers", () => {
    const resolved = resolveConfig({
      headers: [
        {
          source: "/docs/**",
          headers: {
            "x-docs": "1",
          },
        },
        {
          source: "/api/**",
          headers: {
            "x-test": "api",
          },
        },
        {
          source: "/client/*.js",
          headers: {
            "cache-control": "public, max-age=120",
          },
        },
      ],
    });

    expect(resolved.headerRules).toHaveLength(3);
    expect(resolved.headerRules[0]?.matcher.test("/docs")).toBe(true);
    expect(resolved.headerRules[0]?.matcher.test("/docs/api")).toBe(true);
    expect(resolved.headerRules[1]?.matcher.test("/api/hello")).toBe(true);
    expect(resolved.headerRules[1]?.matcher.test("/api/v1/users")).toBe(true);
    expect(resolved.headerRules[1]?.matcher.test("/guides/api")).toBe(false);
    expect(resolved.headerRules[2]?.matcher.test("/client/app.js")).toBe(true);
    expect(resolved.headerRules[2]?.matcher.test("/client/nested/app.js")).toBe(false);
  });

  it("rejects invalid source and headers fields", () => {
    expect(() => resolveConfig({
      headers: [{ source: "api/**", headers: { "x-test": "1" } }],
    })).toThrow("headers[0].source");

    expect(() => resolveConfig({
      headers: [{ source: "/api/**", headers: {} }],
    })).toThrow("headers[0].headers");

    expect(() => resolveConfig({
      headers: [{ source: "/api/**", headers: { "x-test": "" } }],
    })).toThrow("headers[0].headers.x-test");
  });
});
