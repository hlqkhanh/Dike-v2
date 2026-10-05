import { afterEach, expect, it, vi } from "vitest";
import { authRequest, clearAuth, refreshSession, AuthError } from "./client";
afterEach(() => {
  vi.unstubAllGlobals();
  clearAuth();
});
it("loads CSRF in memory, sends cookie credentials and does not retry mutation", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ token: "csrf-test" }))
    .mockResolvedValueOnce(
      Response.json(
        { error: { code: "DEPENDENCY_UNAVAILABLE" } },
        { status: 503 },
      ),
    );
  vi.stubGlobal("fetch", fetch);
  await expect(
    authRequest("updatePhone", "PUT", "/auth/phone", { phone: "0912345678" }),
  ).rejects.toBeInstanceOf(AuthError);
  expect(fetch).toHaveBeenCalledTimes(2);
  const options = fetch.mock.calls[1]?.[1] as RequestInit;
  expect(options.credentials).toBe("include");
  expect(options.headers).toMatchObject({ "X-CSRF-TOKEN": "csrf-test" });
});
it("coalesces concurrent refresh and replaces the CSRF token", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ token: "first" }))
    .mockResolvedValueOnce(Response.json({ token: "rotated" }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetch);
  await Promise.all([refreshSession(), refreshSession()]);
  expect(fetch).toHaveBeenCalledTimes(2);
  await authRequest("logout", "POST", "/auth/logout");
  expect((fetch.mock.calls[2]?.[1] as RequestInit).headers).toMatchObject({
    "X-CSRF-TOKEN": "rotated",
  });
});
