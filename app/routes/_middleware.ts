import type { Middleware } from 'react-bun-ssr/route';

export const middleware: Middleware = async (ctx, next) => {
  ctx.locals.requestStart = Date.now();
  const response = await next();

  const started = Number(ctx.locals.requestStart ?? Date.now());
  response.headers.set('x-route-duration', String(Date.now() - started));
  return response;
};
