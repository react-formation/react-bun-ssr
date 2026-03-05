const DOCTYPE = new TextEncoder().encode("<!doctype html>");

export function prependDoctypeStream(stream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(DOCTYPE);
      reader = stream.getReader();

      try {
        while (true) {
          const result = await reader.read();
          if (result.done) {
            break;
          }
          controller.enqueue(result.value);
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        const activeReader = reader;
        reader = null;
        activeReader?.releaseLock();
      }
    },
    async cancel(reason) {
      const activeReader = reader;
      if (activeReader) {
        await activeReader.cancel(reason);
        return;
      }

      await stream.cancel(reason);
    },
  });
}
