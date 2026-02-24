import type { Middleware, RequestContext } from "./types";

export async function runMiddlewareChain(
  middlewares: Middleware[],
  ctx: RequestContext,
  handler: () => Promise<Response>,
): Promise<Response> {
  let index = -1;

  const dispatch = async (nextIndex: number): Promise<Response> => {
    if (nextIndex <= index) {
      throw new Error("Middleware next() called multiple times");
    }

    index = nextIndex;
    const middleware = middlewares[nextIndex];

    if (!middleware) {
      return handler();
    }

    return middleware(ctx, () => dispatch(nextIndex + 1));
  };

  return dispatch(0);
}
