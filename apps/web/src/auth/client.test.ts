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
    authRequest("updatePhone", { body: { phone: "0912345678" } }),
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
  await authRequest("logout");
  expect((fetch.mock.calls[2]?.[1] as RequestInit).headers).toMatchObject({
    "X-CSRF-TOKEN": "rotated",
  });
});

it("uses generated routes and encodes session IDs without allowing path traversal", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ token: "csrf" }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetch);
  await expect(authRequest("revokeSession")).rejects.toThrow(
    "Missing path parameter",
  );
  expect(fetch).not.toHaveBeenCalled();
  await authRequest("revokeSession", {
    path: { deviceSessionId: "other/session?x=1" },
  });
  expect(fetch.mock.calls[1]?.[0]).toBe(
    "http://localhost:8080/api/v1/auth/sessions/other%2Fsession%3Fx%3D1",
  );
  expect((fetch.mock.calls[1]?.[1] as RequestInit).method).toBe("DELETE");
});

it("reloads stale CSRF on the next attempt without replaying the failed mutation", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ token: "old" }))
    .mockResolvedValueOnce(
      Response.json({ error: { code: "CSRF_INVALID" } }, { status: 403 }),
    )
    .mockResolvedValueOnce(Response.json({ token: "new" }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetch);
  await expect(authRequest("logout")).rejects.toBeInstanceOf(AuthError);
  expect(fetch).toHaveBeenCalledTimes(2);
  await authRequest("logout");
  expect(fetch).toHaveBeenCalledTimes(4);
  expect((fetch.mock.calls[3]?.[1] as RequestInit).headers).toMatchObject({
    "X-CSRF-TOKEN": "new",
  });
});
