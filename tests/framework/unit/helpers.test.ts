import { describe, expect, it } from "bun:test";
import { assertSameOriginAction, json, redirect, sanitizeRedirectTarget } from "../../../framework/runtime/helpers";
import { toRouteErrorResponse } from "../../../framework/runtime/route-errors";
import { safeJsonSerialize } from "../../../framework/runtime/utils";

describe("helpers", () => {
  it("creates JSON responses with proper content type", async () => {
    const response = json({ ok: true }, { status: 201 });
    expect(response.status).toBe(201);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({ ok: true });
  });

  it("creates redirect descriptors", () => {
    const value = redirect("/home", 303);
    expect(value).toEqual({
      type: "redirect",
      location: "/home",
      status: 303,
    });
  });

  it("serializes script-safe JSON", () => {
    const serialized = safeJsonSerialize({
      value: "</script>",
      separatorA: "\u2028",
      separatorB: "\u2029",
    });

    expect(serialized).toContain("\\u003c/script>");
    expect(serialized).not.toContain("</script>");
  });

  it("sanitizes redirect targets to same-origin relative paths", () => {
    expect(sanitizeRedirectTarget("/dashboard?tab=profile#auth")).toBe("/dashboard?tab=profile#auth");
    expect(sanitizeRedirectTarget("dashboard?tab=profile#auth")).toBe("/dashboard?tab=profile#auth");
    expect(sanitizeRedirectTarget("https://evil.example/steal", "/fallback")).toBe("/fallback");
    expect(sanitizeRedirectTarget("//evil.example/steal", "/fallback")).toBe("/fallback");
    expect(sanitizeRedirectTarget("javascript:alert(1)", "/fallback")).toBe("/fallback");
  });

  it("asserts same-origin action submissions", () => {
    expect(() => {
      assertSameOriginAction({
        request: new Request("http://localhost/login", {
          method: "POST",
          headers: {
            origin: "http://localhost",
          },
        }),
        url: new URL("http://localhost/login"),
      });
    }).not.toThrow();

    let thrown: unknown;
    try {
      assertSameOriginAction({
        request: new Request("http://localhost/login", {
          method: "POST",
          headers: {
            origin: "https://evil.example",
          },
        }),
        url: new URL("http://localhost/login"),
      });
    } catch (error) {
      thrown = error;
    }

    const routeError = toRouteErrorResponse(thrown);
    expect(routeError?.status).toBe(403);
  });
});
