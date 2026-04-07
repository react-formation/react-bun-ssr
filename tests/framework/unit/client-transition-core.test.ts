import { describe, expect, it } from "bun:test";
import {
  consumeTransitionChunkText,
  createTransitionChunkParserState,
  flushTransitionChunkText,
} from "../../../framework/runtime/client-transition-core";
import type { TransitionChunkParserState } from "../../../framework/runtime/client-transition-core";

function parseChunks(parts: string[]): TransitionChunkParserState {
  let state = createTransitionChunkParserState();
  for (const part of parts) {
    state = consumeTransitionChunkText(state, part);
  }
  return flushTransitionChunkText(state);
}

describe("client transition core", () => {
  it("parses NDJSON chunks across arbitrary boundaries and preserves deferred order", () => {
    const state = parseChunks([
      '{"type":"initial","kind":"page","status":200,"payload":{"routeId":"index","loaderData":null,"params":{},"url":"http://localhost/"},"head":"<title>Home</title>","redirected":false}\n{"type":"de',
      'ferred","id":"slow:1","ok":true,"value":"first"}\n{"type":"deferred","id":"slow:2","ok":true,"value":"second"}\n',
    ]);

    expect(state.initialChunk?.type).toBe("initial");
    expect(state.deferredChunks.map(chunk => chunk.id)).toEqual(["slow:1", "slow:2"]);
    expect(state.buffer).toBe("");
  });

  it("keeps the first initial chunk when later initial or redirect chunks appear", () => {
    const state = parseChunks([
      '{"type":"initial","kind":"page","status":200,"payload":{"routeId":"index","loaderData":null,"params":{},"url":"http://localhost/"},"head":"first","redirected":false}\n',
      '{"type":"redirect","location":"/elsewhere","status":302}\n',
    ]);

    expect(state.initialChunk).toEqual({
      type: "initial",
      kind: "page",
      status: 200,
      payload: {
        routeId: "index",
        loaderData: null,
        params: {},
        url: "http://localhost/",
      },
      head: "first",
      redirected: false,
    });
  });

  it("processes a trailing buffered chunk on flush and leaves null when no initial chunk exists", () => {
    const state = parseChunks([
      '{"type":"deferred","id":"slow:1","ok":false,"error":"boom"}',
    ]);

    expect(state.initialChunk).toBeNull();
    expect(state.deferredChunks).toEqual([
      {
        type: "deferred",
        id: "slow:1",
        ok: false,
        error: "boom",
      },
    ]);
  });

  it("parses explicit document fallback chunks as the initial transition result", () => {
    const state = parseChunks([
      '{"type":"document","location":"http://localhost/plain","status":202}\n',
      '{"type":"deferred","id":"slow:1","ok":true,"value":"ignored-after-document"}\n',
    ]);

    expect(state.initialChunk).toEqual({
      type: "document",
      location: "http://localhost/plain",
      status: 202,
    });
  });
});
