import type { Middleware } from 'react-bun-ssr/route';
import { normalizeCanonicalPathname } from './lib/site';

export const middleware: Middleware = async (ctx, next) => {
  const canonicalPathname = normalizeCanonicalPathname(ctx.url.pathname);
  if (ctx.url.pathname !== '/' && canonicalPathname !== ctx.url.pathname) {
    const location = `${canonicalPathname}${ctx.url.search}`;
    return Response.redirect(location, 308);
  }

  const response = await next();
  response.headers.set('x-global-middleware', 'true');
  return response;
};
