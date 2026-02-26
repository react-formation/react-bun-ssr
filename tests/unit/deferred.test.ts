import { describe, expect, it } from "bun:test";
import {
  defer,
  isDeferredLoaderResult,
  isDeferredToken,
  prepareDeferredPayload,
} from "../../framework/runtime/deferred";

describe("deferred loader helpers", () => {
  it("creates explicit deferred loader values", () => {
    const value = defer({
      critical: "hello",
      later: Promise.resolve("world"),
    });

    expect(isDeferredLoaderResult(value)).toBe(true);
    expect(value.__rbssrType).toBe("defer");
  });

  it("rejects invalid defer inputs", () => {
    expect(() => defer([] as unknown as Record<string, unknown>)).toThrow();
    expect(() => defer(null as unknown as Record<string, unknown>)).toThrow();
  });

  it("prepares payload tokens and settled entries", async () => {
    const prepared = prepareDeferredPayload(
      "route__id",
      defer({
        immediate: 42,
        asyncValue: Promise.resolve({ ok: true }),
      }),
    );

    expect(prepared.dataForRender.immediate).toBe(42);
    expect(prepared.dataForPayload.immediate).toBe(42);
    expect(isDeferredToken(prepared.dataForPayload.asyncValue)).toBe(true);
    expect(prepared.settleEntries.length).toBe(1);

    const settled = await prepared.settleEntries[0]!.settled;
    expect(settled.ok).toBe(true);
  });
});
