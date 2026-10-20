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
    // The API generates a request ID when the native runtime has no Web Crypto.
    const requestId = globalThis.crypto?.randomUUID?.();
    if (requestId) headers.set("X-Request-Id", requestId);

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "omit",
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
    localLogin: (persona: LocalPersona) =>
      request<{ token: string; expiresAt: string }>(
        `/auth/dev/mobile?persona=${encodeURIComponent(persona)}`,
        { headers: { "X-Dike-Client": "mobile" } },
      ),
    logout: () => request<void>("/auth/logout", { method: "POST" }),
    session: () => request<AuthSessionResponse>("/auth/session"),
    feed: () => request<RidePostPage>("/ride-posts?tab=latest"),
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
    sendMessage: (id: string, text: string) =>
      request<JourneyMessage>(
        `/conversations/${encodeURIComponent(id)}/messages`,
        {
          method: "POST",
          body: JSON.stringify({ clientMessageId: crypto.randomUUID(), text }),
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
