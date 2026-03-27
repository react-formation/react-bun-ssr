export type RouteActionStateHandler<TState = unknown> = (
  previousState: TState,
  formData: FormData,
) => Promise<TState>;

const ROUTE_ACTION_STUB_MARKER = Symbol.for("react-bun-ssr.route-action-stub");

export function markRouteActionStub<TState>(
  handler: RouteActionStateHandler<TState>,
): RouteActionStateHandler<TState> {
  Object.defineProperty(handler, ROUTE_ACTION_STUB_MARKER, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return handler;
}

export function isRouteActionStub(value: unknown): value is RouteActionStateHandler<unknown> {
  if (typeof value !== "function") {
    return false;
  }

  return (value as unknown as Record<PropertyKey, unknown>)[ROUTE_ACTION_STUB_MARKER] === true;
}
