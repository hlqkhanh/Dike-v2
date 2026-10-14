import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  createApiClientConfiguration,
  createAuthApi,
  createProfileApi,
} from "./index";

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

    await api.submitPhone("0901234567", 0);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/auth/phone");
    expect(init.credentials).toBe("include");
    expect(init.cache).toBe("no-store");
    expect(new Headers(init.headers).get("X-XSRF-TOKEN")).toBe("csrf+value");
  });

  it("exposes Retry-After for rate limited requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: "OTP_RATE_LIMITED", message: "Thử lại sau" },
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": "42",
            },
          },
        ),
      ),
    );
    const api = createAuthApi({ baseUrl: "/api/v1" });

    await expect(api.issueOtp(1, "request-1")).rejects.toMatchObject({
      status: 429,
      code: "OTP_RATE_LIMITED",
      retryAfterSeconds: 42,
    } satisfies Partial<ApiError>);
  });
});

describe("profile and file API", () => {
  it("keeps profile mutations on the API origin with CSRF", async () => {
    vi.stubGlobal("document", { cookie: "XSRF-TOKEN=profile-csrf" });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          userId: "user-1",
          displayName: "Nguyễn An",
          bio: "",
          version: 2,
          updatedAt: "2026-10-06T00:00:00Z",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const api = createProfileApi({ baseUrl: "/api/v1" });

    await api.updateProfile({
      displayName: "Nguyễn An",
      bio: "",
      expectedVersion: 1,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/me/profile");
    expect(init.method).toBe("PATCH");
    expect(new Headers(init.headers).get("X-XSRF-TOKEN")).toBe("profile-csrf");
  });

  it("uploads bytes only to the fixed presigned URL and without cookies", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const api = createProfileApi({ baseUrl: "/api/v1" });
    const file = new File(["synthetic"], "avatar.png", { type: "image/png" });

    await api.uploadToGrantedUrl(
      {
        fileId: "file-1",
        uploadUrl: "https://objects.example.test/signed",
        requiredHeaders: { "content-type": "image/png" },
        expiresAt: "2026-10-06T00:05:00Z",
      },
      file,
    );

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://objects.example.test/signed");
    expect(init.method).toBe("PUT");
    expect(init.credentials).toBeUndefined();
  });
});
