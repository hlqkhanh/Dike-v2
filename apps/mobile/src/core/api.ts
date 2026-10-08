import type { AuthSessionResponse } from "@dike/api-client-ts";

export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080/api/v1"
).replace(/\/$/u, "");

export class MobileApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function createMobileApi(getToken: () => Promise<string | null>) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (init.body) headers.set("Content-Type", "application/json");
    const token = await getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    headers.set("X-Request-Id", crypto.randomUUID());

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => undefined)) as
        | { error?: { code?: string; message?: string } }
        | undefined;
      throw new MobileApiError(
        response.status,
        body?.error?.code ?? "REQUEST_FAILED",
        body?.error?.message ?? "Không thể kết nối Dike.",
      );
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  return {
    session: () => request<AuthSessionResponse>("/auth/session"),
    feed: () => request<{ items: unknown[] }>("/ride-posts?tab=recent"),
    trips: () => request<{ items: unknown[] }>("/trips"),
    bookings: () => request<{ items: unknown[] }>("/bookings"),
    conversations: () => request<unknown[]>("/conversations"),
    notifications: () => request<unknown[]>("/notifications"),
  };
}
