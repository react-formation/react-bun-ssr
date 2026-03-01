import { describe, expect, it } from "bun:test";
import {
  createRouteErrorResponse,
  isRouteErrorResponse,
  notFound,
  routeError,
  sanitizeRouteErrorResponse,
  toRouteErrorResponse,
} from "../../framework/runtime/route-errors";

function captureThrown(thunk: () => unknown): unknown {
  try {
    thunk();
  } catch (error) {
    return error;
  }
  return null;
}

describe("route error helpers", () => {
  it("throws typed caught errors via routeError()", () => {
    const thrown = captureThrown(() => routeError(418, { code: "TEAPOT" }));
    const caught = toRouteErrorResponse(thrown);
    expect(caught).not.toBeNull();
    expect(caught?.status).toBe(418);
    expect(caught?.data).toEqual({ code: "TEAPOT" });
  });

  it("throws typed 404 via notFound()", () => {
    const thrown = captureThrown(() => notFound({ slug: "missing" }));
    const caught = toRouteErrorResponse(thrown);
    expect(caught).not.toBeNull();
    expect(caught?.status).toBe(404);
    expect(caught?.statusText).toBe("Not Found");
  });

  it("accepts thrown non-redirect Response objects as caught errors", () => {
    const thrown = new Response("bad", { status: 422, statusText: "Unprocessable Entity" });
    const caught = toRouteErrorResponse(thrown);
    expect(caught).not.toBeNull();
    expect(caught?.status).toBe(422);
    expect(caught?.statusText).toBe("Unprocessable Entity");
  });

  it("rejects redirect Response objects from caught classification", () => {
    const redirectResponse = Response.redirect("http://localhost/next", 302);
    expect(toRouteErrorResponse(redirectResponse)).toBeNull();
  });

  it("guards RouteErrorResponse values", () => {
    const routeErrorResponse = createRouteErrorResponse(400, { field: "title" });
    expect(isRouteErrorResponse(routeErrorResponse)).toBe(true);
    expect(isRouteErrorResponse({ status: 400 })).toBe(false);
  });

  it("sanitizes caught 5xx payload data in production mode", () => {
    const value = createRouteErrorResponse(503, { detail: "origin failure" }, { statusText: "Service Unavailable" });
    const sanitized = sanitizeRouteErrorResponse(value, true);
    expect(sanitized.status).toBe(503);
    expect(sanitized.statusText).toBe("Internal Server Error");
    expect(sanitized.data).toBeUndefined();
  });
});

