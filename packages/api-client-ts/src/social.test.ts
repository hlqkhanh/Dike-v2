import { afterEach, expect, it, vi } from "vitest";
import { createSocialApi } from "./social";
import { ApiError } from "./auth";

afterEach(() => vi.unstubAllGlobals());

it("preserves idempotency on retry and sends CSRF without caching", async () => {
  vi.stubGlobal("document", { cookie: "XSRF-TOKEN=csrf%2Btoken" });
  const fetchMock = vi
    .fn()
    .mockImplementation(() =>
      Promise.resolve(new Response("{}", { status: 200 })),
    );
  vi.stubGlobal("fetch", fetchMock);
  const api = createSocialApi({ baseUrl: "/api/v1" });
  await api.act("SEND", "other", null, "same-key-1");
  await api.act("SEND", "other", null, "same-key-1");
  for (const [url, init] of fetchMock.mock.calls as [string, RequestInit][]) {
    expect(url).toBe("/api/v1/friendships/requests");
    expect(init.credentials).toBe("include");
    expect(init.cache).toBe("no-store");
    expect(new Headers(init.headers).get("X-XSRF-TOKEN")).toBe("csrf+token");
    expect(new Headers(init.headers).get("Idempotency-Key")).toBe("same-key-1");
    expect(JSON.parse(init.body as string)).toEqual({ targetUserId: "other" });
  }
});

it("encodes cursors and surfaces generic denied errors", async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        error: {
          code: "RESOURCE_NOT_AVAILABLE",
          message: "Không tìm thấy nội dung",
        },
      }),
      { status: 404 },
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  const api = createSocialApi({ baseUrl: "/api/v1" });
  await expect(api.list("incoming", "a&b")).rejects.toBeInstanceOf(ApiError);
  expect(fetchMock.mock.calls[0][0]).toBe(
    "/api/v1/friendships/requests?direction=incoming&cursor=a%26b",
  );
});
