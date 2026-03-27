import { describe, expect, it } from "bun:test";
import { normalizeCanonicalPathname } from "../../../app/lib/site";

describe("site URL helpers", () => {
  it("keeps the root pathname canonical", () => {
    expect(normalizeCanonicalPathname("/")).toBe("/");
  });

  it("removes trailing slashes from non-root pathnames", () => {
    expect(normalizeCanonicalPathname("/docs/")).toBe("/docs");
    expect(normalizeCanonicalPathname("/docs/data/loaders///")).toBe("/docs/data/loaders");
  });
});
