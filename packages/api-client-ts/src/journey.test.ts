import { afterEach, expect, it, vi } from "vitest";
import { createJourneyApi } from "./journey";

afterEach(() => vi.unstubAllGlobals());

it("opens a journey discussion without sending a message", async () => {
  vi.stubGlobal("document", { cookie: "XSRF-TOKEN=csrf%2Btoken" });
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ id: "chat" }), { status: 200 }),
    );
  vi.stubGlobal("fetch", fetchMock);
  const api = createJourneyApi({ baseUrl: "/api/v1" });
  await api.discussPost("demo:owner:post-offer");
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe("/api/v1/conversations/ride-post");
  expect(init.method).toBe("POST");
  expect(new Headers(init.headers).get("X-XSRF-TOKEN")).toBe("csrf+token");
  expect(JSON.parse(init.body as string)).toEqual({
    postId: "demo:owner:post-offer",
  });
});

it("includes the pending post only when sending a message", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  await createJourneyApi({ baseUrl: "/api/v1" }).sendMessage(
    "chat",
    "Hello",
    "stable-message-key",
    "demo:owner:post-offer",
  );
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe("/api/v1/conversations/chat/messages");
  expect(JSON.parse(init.body as string)).toEqual({
    text: "Hello",
    clientMessageId: "stable-message-key",
    postId: "demo:owner:post-offer",
  });
});
