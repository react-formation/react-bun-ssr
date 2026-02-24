import { describe, expect, it } from "bun:test";
import { json, redirect } from "../../framework/runtime/helpers";
import { safeJsonSerialize } from "../../framework/runtime/utils";

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
});
