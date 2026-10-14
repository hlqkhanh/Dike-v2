import { ApiError } from "@dike/api-client-ts";
import { QueryClient } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { handleAuthenticationError } from "./session-expiry";

it("removes previously authorized data without resetting and re-fetching the anonymous session", async () => {
  const client = new QueryClient();
  client.setQueryData(["auth", "session"], { authenticated: true });
  client.setQueryData(
    ["conversation", "private-chat"],
    [{ text: "Private message" }],
  );
  client.setQueryData(["profile", "me"], { displayName: "Member" });
  expect(
    handleAuthenticationError(
      client,
      new ApiError(401, "UNAUTHENTICATED", "Expired"),
    ),
  ).toBe(true);
  expect(client.getQueryData(["auth", "session"])).toBeNull();
  await vi.waitFor(() =>
    expect(
      client.getQueryData(["conversation", "private-chat"]),
    ).toBeUndefined(),
  );
  expect(client.getQueryData(["profile", "me"])).toBeUndefined();
  expect(client.getQueryState(["auth", "session"])?.status).toBe("success");
  client.clear();
});

it.each([403, 404, 500, 503])(
  "keeps the session on status %s rather than treating all failures as logout",
  (status) => {
    const client = new QueryClient();
    const session = { authenticated: true };
    client.setQueryData(["auth", "session"], session);
    expect(
      handleAuthenticationError(client, new ApiError(status, "ERROR", "Error")),
    ).toBe(false);
    expect(client.getQueryData(["auth", "session"])).toEqual(session);
    client.clear();
  },
);
