import { describe, expect, it } from "bun:test";
import { prependDoctypeStream } from "../../../framework/runtime/doctype-stream";

const decoder = new TextDecoder();

function toBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

describe("doctype stream wrapper", () => {
  it("prepends doctype and forwards source chunks in order", async () => {
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(toBytes("<html>"));
        controller.enqueue(toBytes("<body>ok</body></html>"));
        controller.close();
      },
    });

    const wrapped = prependDoctypeStream(source);
    const html = await new Response(wrapped).text();

    expect(html).toBe("<!doctype html><html><body>ok</body></html>");
  });

  it("cancels through the active reader without locked-stream errors", async () => {
    let cancelled = false;

    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(toBytes("<html>"));
      },
      cancel() {
        cancelled = true;
      },
    });

    const wrapped = prependDoctypeStream(source);
    const wrappedReader = wrapped.getReader();

    const firstChunk = await wrappedReader.read();
    expect(firstChunk.done).toBe(false);
    expect(decoder.decode(firstChunk.value)).toBe("<!doctype html>");

    await expect(wrappedReader.cancel("test-cancel")).resolves.toBeUndefined();
    expect(cancelled).toBe(true);
  });

  it("releases the source reader lock when the source completes", async () => {
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(toBytes("<html>"));
        controller.close();
      },
    });

    const wrapped = prependDoctypeStream(source);
    await new Response(wrapped).text();

    expect(source.locked).toBe(false);
  });

  it("propagates source errors and releases the source reader lock", async () => {
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error("source-failure"));
      },
    });

    const wrapped = prependDoctypeStream(source);
    await expect(new Response(wrapped).text()).rejects.toThrow("source-failure");
    expect(source.locked).toBe(false);
  });
});
