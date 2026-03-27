import { describe, expect, it } from "bun:test";
import { applyResponseContext, createResponseContext } from "../../../framework/runtime/response-context";

describe("response context", () => {
  it("tracks header and cookie mutations and applies them to final responses", async () => {
    const requestCookies = new Map<string, string>([
      ["session", "abc123"],
    ]);
    const responseContext = createResponseContext(requestCookies);

    responseContext.headers.set("x-powered-by", "rbssr");
    responseContext.headers.append("x-powered-by", "bun");
    responseContext.headers.delete("x-remove");
    responseContext.cookies.set("session", "updated", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
    responseContext.cookies.delete("flash", { path: "/" });

    expect(responseContext.cookies.get("session")).toBe("updated");
    expect(responseContext.cookies.get("flash")).toBeUndefined();

    const baseResponse = new Response("ok", {
      status: 201,
      headers: {
        "x-remove": "1",
        "x-existing": "keep",
      },
    });

    const finalResponse = applyResponseContext(baseResponse, responseContext);
    expect(finalResponse.status).toBe(201);
    expect(finalResponse.headers.get("x-existing")).toBe("keep");
    expect(finalResponse.headers.get("x-remove")).toBeNull();
    expect(finalResponse.headers.get("x-powered-by")).toContain("rbssr");
    expect(finalResponse.headers.get("x-powered-by")).toContain("bun");

    const setCookie = finalResponse.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("session=updated");
    expect(setCookie).toContain("flash=");
    expect(await finalResponse.text()).toBe("ok");
  });
});
