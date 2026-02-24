import { describe, expect, it } from "bun:test";
import { runMiddlewareChain } from "../../framework/runtime/middleware";

describe("runMiddlewareChain", () => {
  it("executes middleware in order", async () => {
    const calls: string[] = [];

    const response = await runMiddlewareChain(
      [
        async (ctx, next) => {
          calls.push("a:before");
          const result = await next();
          calls.push("a:after");
          return result;
        },
        async (ctx, next) => {
          calls.push("b:before");
          const result = await next();
          calls.push("b:after");
          return result;
        },
      ],
      {
        request: new Request("http://localhost/"),
        url: new URL("http://localhost/"),
        params: {},
        cookies: new Map(),
        locals: {},
      },
      async () => {
        calls.push("handler");
        return new Response("ok");
      },
    );

    expect(await response.text()).toBe("ok");
    expect(calls).toEqual(["a:before", "b:before", "handler", "b:after", "a:after"]);
  });

  it("throws when next() is called multiple times", async () => {
    let caught: unknown = null;

    try {
      await runMiddlewareChain(
        [
          async (ctx, next) => {
            await next();
            return next();
          },
        ],
        {
          request: new Request("http://localhost/"),
          url: new URL("http://localhost/"),
          params: {},
          cookies: new Map(),
          locals: {},
        },
        async () => new Response("ok"),
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain("called multiple times");
  });
});
