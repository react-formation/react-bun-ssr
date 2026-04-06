import { resolveConfig } from "./config";
import { createRequestExecutor } from "./request-executor";
import type { FrameworkConfig, ServerRuntimeOptions } from "./types";

export { toClientRouteSnapshots } from "./request-executor";

export function createServer(
  config: FrameworkConfig = {},
  runtimeOptions: ServerRuntimeOptions = {},
): { fetch(req: Request): Promise<Response> } {
  const resolvedConfig = resolveConfig(config);
  return createRequestExecutor({
    config: resolvedConfig,
    runtimeOptions,
  });
}

export function startHttpServer(options: {
  config: FrameworkConfig;
  runtimeOptions?: ServerRuntimeOptions;
}): void {
  const server = createServer(options.config, options.runtimeOptions);
  const resolved = resolveConfig(options.config);

  const bunServer = Bun.serve({
    port: resolved.port,
    hostname: resolved.host,
    fetch: server.fetch,
    development: resolved.mode === "development",
  });

  // eslint-disable-next-line no-console
  console.log(`[react-bun-ssr] listening on ${bunServer.url}`);
}
