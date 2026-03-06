import type { Middleware } from "react-bun-ssr/route";

export const middleware: Middleware = async (_ctx, next) => {
  const response = await next();
  response.headers.set("x-powered-by", "react-bun-ssr");
  return response;
};
