import type {
  AuthSessionResponse,
  BookingPage,
  JourneyMessage,
  JourneyNotification,
  JourneyConversation,
  PublicProfileResponse,
  RidePostResponse,
  RidePostView,
  RidePostPage,
  ScheduleResponse,
  TripPage,
  TripView,
} from "@dike/api-client-ts";
import { randomUUID } from "expo-crypto";

let onSessionExpired: (() => void) | undefined;
export function setSessionExpiredHandler(handler?: () => void) {
  onSessionExpired = handler;
}

export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080/api/v1"
).replace(/\/$/u, "");

export type LocalPersona = "member" | "driver" | "admin";

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
    headers.set("X-Request-Id", randomUUID());

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        credentials: "omit",
        headers,
        signal: controller.signal,
      });
    } catch {
      throw new MobileApiError(
        0,
        "NETWORK_UNAVAILABLE",
        "Chưa thể kết nối Dike. Kiểm tra mạng và thử lại.",
      );
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      if (response.status === 401 && token) onSessionExpired?.();
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
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  return {
    localLogin: (persona: LocalPersona) =>
      request<{ token: string; expiresAt: string }>(
        `/auth/dev/mobile?persona=${encodeURIComponent(persona)}`,
        { headers: { "X-Dike-Client": "mobile" } },
      ),
    call: <T>(
      path: string,
      method = "GET",
      body?: unknown,
      key?: string,
      extraHeaders?: Record<string, string>,
    ) =>
      request<T>(path, {
        method,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        headers: {
          ...(key ? { "Idempotency-Key": key } : {}),
          ...extraHeaders,
        },
      }),
    logout: () => request<void>("/auth/logout", { method: "POST" }),
    session: () => request<AuthSessionResponse>("/auth/session"),
    feed: (cursor?: string) =>
      request<RidePostPage>(
        `/ride-posts?tab=latest${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
      ),
    trips: () => request<TripPage>("/trips"),
    trip: (id: string) => request<TripView>(`/trips/${encodeURIComponent(id)}`),
    bookings: () => request<BookingPage>("/bookings"),
    conversations: () => request<JourneyConversation[]>("/conversations"),
    conversation: (id: string) =>
      request<JourneyConversation>(`/conversations/${encodeURIComponent(id)}`),
    messages: (id: string) =>
      request<JourneyMessage[]>(
        `/conversations/${encodeURIComponent(id)}/messages`,
      ),
    sendMessage: (id: string, text: string, clientMessageId = randomUUID()) =>
      request<JourneyMessage>(
        `/conversations/${encodeURIComponent(id)}/messages`,
        {
          method: "POST",
          body: JSON.stringify({ clientMessageId, text }),
        },
      ),
    notifications: () => request<JourneyNotification[]>("/notifications"),
    readNotification: (id: string) =>
      request<void>(`/notifications/${encodeURIComponent(id)}/read`, {
        method: "PATCH",
      }),
    post: (id: string) =>
      request<RidePostView>(`/ride-posts/${encodeURIComponent(id)}`),
    postResponses: (id: string) =>
      request<RidePostResponse[]>(
        `/ride-posts/${encodeURIComponent(id)}/responses`,
      ),
    requestRide: (id: string, message: string) =>
      request<RidePostResponse>(
        `/ride-posts/${encodeURIComponent(id)}/responses`,
        { method: "POST", body: JSON.stringify({ message }) },
      ),
    userProfile: (id: string) =>
      request<PublicProfileResponse>(`/users/${encodeURIComponent(id)}`),
    schedules: () => request<ScheduleResponse[]>("/schedules"),
  };
}
