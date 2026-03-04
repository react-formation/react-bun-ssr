import { describe, expect, it } from "bun:test";
import { isFrameworkTestPath } from "../../../app/lib/internal-routes";

describe("internal route detection", () => {
  it("matches the hidden framework test route tree", () => {
    expect(isFrameworkTestPath("/framework-test")).toBe(true);
    expect(isFrameworkTestPath("/framework-test/deferred-reject")).toBe(true);
  });

  it("does not match public docs and blog pages", () => {
    expect(isFrameworkTestPath("/docs")).toBe(false);
    expect(isFrameworkTestPath("/docs/start/quick-start")).toBe(false);
    expect(isFrameworkTestPath("/blog")).toBe(false);
  });
});

