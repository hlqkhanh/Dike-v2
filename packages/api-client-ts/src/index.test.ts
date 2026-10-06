import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiClientConfiguration, createAuthApi } from "./index";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("API client configuration", () => {
  it("normalizes the base URL and defaults to cookie credentials", () => {
    expect(
      createApiClientConfiguration({
        baseUrl: "http://localhost:8080/api/v1/",
      }),
    ).toEqual({
      baseUrl: "http://localhost:8080/api/v1",
      credentials: "include",
      requestId: undefined,
    });
  });
});

describe("auth API", () => {
  it("uses same-origin credentials and sends the CSRF cookie on mutations", async () => {
    vi.stubGlobal("document", { cookie: "XSRF-TOKEN=csrf%2Bvalue" });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          authenticated: true,
          user: {},
          session: {},
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const api = createAuthApi({ baseUrl: "/api/v1" });

    await api.submitPhone("0901234567");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/auth/phone");
    expect(init.credentials).toBe("include");
    expect(init.cache).toBe("no-store");
    expect(new Headers(init.headers).get("X-XSRF-TOKEN")).toBe("csrf+value");
  });
});
