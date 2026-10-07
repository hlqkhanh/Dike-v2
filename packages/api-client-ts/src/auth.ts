import {
  createApiClientConfiguration,
  type ApiClientConfiguration,
} from "./configuration";
import type {
  AuthSessionResponse,
  ChallengeView,
  SessionListResponse,
} from "./generated/schema";

export type OtpChallenge = Omit<ChallengeView, "maskedPhone"> & {
  maskedPhone?: string;
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

export function createAuthApi(configuration: ApiClientConfiguration) {
  const config = createApiClientConfiguration(configuration);

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    const requestId = config.requestId?.();
    if (requestId) headers.set("X-Request-Id", requestId);
    if (init.body) headers.set("Content-Type", "application/json");
    if (init.method && !["GET", "HEAD", "OPTIONS"].includes(init.method)) {
      const csrf = readCookie("XSRF-TOKEN");
      if (csrf) headers.set("X-XSRF-TOKEN", decodeURIComponent(csrf));
    }

    const response = await fetch(`${config.baseUrl}${path}`, {
      ...init,
      headers,
      credentials: config.credentials,
      cache: "no-store",
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => undefined)) as
        | { error?: { code?: string; message?: string } }
        | undefined;
      throw new ApiError(
        response.status,
        body?.error?.code ?? "REQUEST_FAILED",
        body?.error?.message ?? "Không thể xử lý yêu cầu",
        parseRetryAfter(response.headers.get("Retry-After")),
      );
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  return {
    session: () => request<AuthSessionResponse>("/auth/session"),
    refresh: () =>
      request<AuthSessionResponse>("/auth/session/refresh", { method: "POST" }),
    sessions: () => request<SessionListResponse>("/auth/sessions"),
    submitPhone: (phoneNumber: string, expectedPhoneVersion: number) =>
      request<AuthSessionResponse>("/auth/phone", {
        method: "PUT",
        body: JSON.stringify({ phoneNumber, expectedPhoneVersion }),
      }),
    issueOtp: (phoneVersion: number, idempotencyKey: string) =>
      request<OtpChallenge>("/auth/otp", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ purpose: "VERIFY_PHONE", phoneVersion }),
      }),
    otpStatus: (challengeId: string) =>
      request<OtpChallenge>(`/auth/otp/${encodeURIComponent(challengeId)}`),
    verifyOtp: (challengeId: string, code: string, idempotencyKey: string) =>
      request<AuthSessionResponse>(
        `/auth/otp/${encodeURIComponent(challengeId)}/verify`,
        {
          method: "POST",
          headers: { "Idempotency-Key": idempotencyKey },
          body: JSON.stringify({ code }),
        },
      ),
    cancelOtp: (challengeId: string) =>
      request<void>(`/auth/otp/${encodeURIComponent(challengeId)}`, {
        method: "DELETE",
      }),
    revoke: (sessionId: string) =>
      request<void>(`/auth/sessions/${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
      }),
    logout: () => request<void>("/auth/logout", { method: "POST" }),
    logoutAll: () => request<void>("/auth/logout-all", { method: "POST" }),
  };
}

function parseRetryAfter(value: string | null): number | undefined {
  if (value === null || !/^\d+$/.test(value)) return undefined;
  return Number(value);
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const prefix = `${name}=`;
  return document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
}
