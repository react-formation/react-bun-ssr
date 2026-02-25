import type { Middleware } from 'react-bun-ssr/route';

export const middleware: Middleware = async (ctx, next) => {
  const response = await next();
  response.headers.set('x-global-middleware', 'true');
  return response;
};
