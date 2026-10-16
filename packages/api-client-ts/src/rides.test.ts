import { afterEach, expect, it, vi } from "vitest";
import { createRideApi } from "./rides";
import { ApiError } from "./auth";
afterEach(() => vi.unstubAllGlobals());
it("keeps the acceptance key across retries and sends CSRF without caching", async () => {
  vi.stubGlobal("document", { cookie: "XSRF-TOKEN=csrf%2Btoken" });
  const fetchMock = vi
    .fn()
    .mockImplementation(() =>
      Promise.resolve(new Response("{}", { status: 200 })),
    );
  vi.stubGlobal("fetch", fetchMock);
  const api = createRideApi({ baseUrl: "/api/v1" });
  await api.accept("a/b", 2, "retry-key-1");
  await api.accept("a/b", 2, "retry-key-1");
  for (const [url, init] of fetchMock.mock.calls as [string, RequestInit][]) {
    expect(url).toBe("/api/v1/proposals/a%2Fb/accept");
    expect(init.cache).toBe("no-store");
    expect(init.credentials).toBe("include");
    expect(new Headers(init.headers).get("X-XSRF-TOKEN")).toBe("csrf+token");
    expect(new Headers(init.headers).get("Idempotency-Key")).toBe(
      "retry-key-1",
    );
    expect(JSON.parse(init.body as string)).toEqual({ version: 2 });
  }
});
it("initializes CSRF before the first ride mutation", async () => {
  let cookie = "";
  vi.stubGlobal("document", {
    get cookie() {
      return cookie;
    },
  });
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    if (url === "/api/v1/auth/session") {
      cookie = "XSRF-TOKEN=initialized%2Btoken";
      return new Response(
        JSON.stringify({ authenticated: true, user: { id: "viewer" } }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify({ items: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);

  await createRideApi({ baseUrl: "/api/v1" }).discover({
    routeId: "route",
    role: "driver",
    departureAt: "2026-10-16T01:00:00Z",
    seats: 1,
  });

  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/v1/auth/session");
  expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/v1/ride-discovery");
  expect(
    new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get("X-XSRF-TOKEN"),
  ).toBe("initialized+token");
});
it("accepts empty save responses", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
  );
  await expect(
    createRideApi({ baseUrl: "/api/v1" }).save("post", true),
  ).resolves.toBeUndefined();
});
it("loads a proposal detail using an encoded identifier", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  await createRideApi({ baseUrl: "/api/v1" }).proposal("proposal/a");

  expect(fetchMock).toHaveBeenCalledWith(
    "/api/v1/proposals/proposal%2Fa",
    expect.objectContaining({ method: "GET", cache: "no-store" }),
  );
});
it("surfaces conflict errors without treating stale data as success", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: "CONCURRENT_CHANGE", message: "Tải lại" },
        }),
        { status: 409 },
      ),
    ),
  );
  await expect(
    createRideApi({ baseUrl: "/api/v1" }).accept("p", 1, "retry-key-1"),
  ).rejects.toBeInstanceOf(ApiError);
});
