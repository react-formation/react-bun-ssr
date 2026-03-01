import path from "node:path";
import { describe, expect, it } from "bun:test";
import {
  fromFileUrl,
  sanitizeErrorMessage,
  toFileImportUrl,
} from "../../framework/runtime/utils";

describe("runtime utils", () => {
  it("round-trips file paths with special characters via Bun file URL utilities", () => {
    const absolutePath = path.resolve("/tmp/dir with spaces/a#b?c.ts");
    const fileUrl = toFileImportUrl(absolutePath);
    const expectedUrl = Bun.pathToFileURL(absolutePath).toString();

    expect(fileUrl).toBe(expectedUrl);
    expect(fromFileUrl(fileUrl)).toBe(absolutePath);
  });

  it("keeps Error message behavior unchanged in development mode", () => {
    expect(sanitizeErrorMessage(new Error("boom"), false)).toBe("boom");
  });

  it("keeps string values unchanged in development mode", () => {
    expect(sanitizeErrorMessage("boom", false)).toBe("boom");
  });

  it("formats non-Error development values via Bun.inspect", () => {
    const circular: { self?: unknown; label: string } = { label: "x" };
    circular.self = circular;

    const formatted = sanitizeErrorMessage(circular, false);
    expect(formatted).toContain("label");
    expect(formatted.length).toBeGreaterThan(0);
  });
});
