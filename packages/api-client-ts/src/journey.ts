import { ApiError } from "./auth";
import {
  createApiClientConfiguration,
  type ApiClientConfiguration,
} from "./configuration";

export type JourneyConversation = {
  id: string;
  type: "DIRECT" | "BOOKING";
  state: string;
  participantIds: string[];
  bookingId?: string;
  lastMessageAt?: string;
  unreadCount: number;
  version: number;
};
export type JourneyMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  clientMessageId: string;
  sequence: number;
  text?: string;
  createdAt: string;
  hidden: boolean;
};
export type JourneyNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, string>;
  createdAt: string;
  readAt?: string;
};
export type JourneyRealtimeTicket = {
  ticket: string;
  websocketUrl: string;
  expiresAt: string;
};
export type PaymentAcknowledgement = {
  bookingId: string;
  amountVnd: number;
  passengerPaidAt?: string;
  driverReceivedAt?: string;
  status: string;
  locked: boolean;
  bankVerified: false;
  version: number;
};
export type ReviewEligibility = {
  bookingId: string;
  eligible: boolean;
  revieweeId: string;
  revieweeRole: string;
  deadline: string;
  submitted: boolean;
};
export type JourneyReview = {
  id: string;
  reviewerId?: string;
  reviewerDisplayName: string;
  revieweeId: string;
  role: string;
  stars: number;
  comment?: string;
  publicationStatus: string;
  moderationStatus: string;
  publishedAt?: string;
};
export type JourneyAvailability = {
  handle: string;
  tripId: string;
  enabledAt: string;
  lastHeartbeatAt: string;
  expiresAt: string;
  areaCenter?: { latitude: number; longitude: number };
  accuracyRadiusMeters: number;
  stale: boolean;
  liveTrackingAvailable: boolean;
};
export type JourneyLocation = {
  userId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  source: string;
  updatedAt: string;
  stale: boolean;
};
export type ReportView = {
  id: string;
  reporterId: string;
  targetType: string;
  targetId: string;
  reason: string;
  status: string;
  priority: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export function createJourneyApi(configuration: ApiClientConfiguration) {
  const config = createApiClientConfiguration(configuration);
  async function request<T>(
    path: string,
    method = "GET",
    body?: unknown,
    key?: string,
  ): Promise<T> {
    const headers = new Headers({ Accept: "application/json" });
    if (body !== undefined) headers.set("Content-Type", "application/json");
    if (key) headers.set("Idempotency-Key", key);
    const requestId = config.requestId?.();
    if (requestId) headers.set("X-Request-Id", requestId);
    if (method !== "GET" && typeof document !== "undefined") {
      const token = document.cookie
        .split("; ")
        .find((cookie) => cookie.startsWith("XSRF-TOKEN="))
        ?.slice(11);
      if (token) headers.set("X-XSRF-TOKEN", decodeURIComponent(token));
    }
    const response = await fetch(`${config.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: config.credentials,
      cache: "no-store",
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new ApiError(
        response.status,
        error?.error?.code ?? "JOURNEY_REQUEST_FAILED",
        error?.error?.message ?? "Không thể xử lý yêu cầu.",
      );
    }
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }
  const id = encodeURIComponent;
  return {
    realtimeTicket: () =>
      request<JourneyRealtimeTicket>("/realtime/tickets", "POST"),
    conversations: () => request<JourneyConversation[]>("/conversations"),
    direct: (recipientUserId: string) =>
      request<JourneyConversation>("/conversations/direct", "POST", {
        recipientUserId,
      }),
    decideRequest: (conversationId: string, accept: boolean, version: number) =>
      request<JourneyConversation>(
        `/message-requests/${id(conversationId)}/${accept ? "accept" : "reject"}`,
        "POST",
        { version },
      ),
    messages: (conversationId: string) =>
      request<JourneyMessage[]>(
        `/conversations/${id(conversationId)}/messages`,
      ),
    sendMessage: (
      conversationId: string,
      text: string,
      clientMessageId = crypto.randomUUID(),
    ) =>
      request<JourneyMessage>(
        `/conversations/${id(conversationId)}/messages`,
        "POST",
        { clientMessageId, text },
      ),
    read: (conversationId: string, sequence: number) =>
      request<void>(`/conversations/${id(conversationId)}/read`, "POST", {
        sequence,
      }),
    notifications: () => request<JourneyNotification[]>("/notifications"),
    readNotification: (notificationId: string) =>
      request<void>(`/notifications/${id(notificationId)}/read`, "PATCH"),
    readAllNotifications: () =>
      request<void>("/notifications/read-all", "POST"),
    payment: (bookingId: string) =>
      request<PaymentAcknowledgement>(
        `/bookings/${id(bookingId)}/payment-acknowledgement`,
      ),
    acknowledgePayment: (
      bookingId: string,
      kind: "paid" | "received",
      enabled: boolean,
    ) =>
      request<PaymentAcknowledgement>(
        `/bookings/${id(bookingId)}/payment-acknowledgement/${kind}`,
        enabled ? "PUT" : "DELETE",
      ),
    reviewEligibility: (bookingId: string) =>
      request<ReviewEligibility>(
        `/bookings/${id(bookingId)}/review-eligibility`,
      ),
    bookingReviews: (bookingId: string) =>
      request<JourneyReview[]>(`/bookings/${id(bookingId)}/reviews`),
    submitReview: (bookingId: string, stars: number, comment: string) =>
      request<JourneyReview>("/reviews", "POST", { bookingId, stars, comment }),
    availability: () => request<JourneyAvailability>("/availability/me"),
    enableAvailability: (
      tripId: string,
      latitude?: number,
      longitude?: number,
      accuracyMeters?: number,
    ) =>
      request<JourneyAvailability>("/availability/me", "PUT", {
        tripId,
        latitude,
        longitude,
        accuracyMeters,
      }),
    heartbeat: () =>
      request<JourneyAvailability>("/availability/me/heartbeat", "POST"),
    disableAvailability: () => request<void>("/availability/me", "DELETE"),
    locationConsent: (bookingId: string, enabled: boolean) =>
      request<void>(
        `/bookings/${id(bookingId)}/live-location-consent`,
        enabled ? "PUT" : "DELETE",
      ),
    liveLocations: (bookingId: string) =>
      request<{ locations: JourneyLocation[] }>(
        `/bookings/${id(bookingId)}/live-location`,
      ),
    updateLiveLocation: (
      bookingId: string,
      latitude: number,
      longitude: number,
      accuracyMeters: number,
    ) =>
      request<JourneyLocation>(
        `/bookings/${id(bookingId)}/live-location`,
        "PUT",
        {
          clientLocationId: crypto.randomUUID(),
          source: "GPS",
          latitude,
          longitude,
          accuracyMeters,
        },
      ),
    report: (body: {
      targetType: string;
      targetId: string;
      contextBookingId?: string;
      reason: string;
      note?: string;
    }) => request<ReportView>("/reports", "POST", body),
    adminReports: () => request<ReportView[]>("/admin/reports"),
    claimReport: (reportId: string, version: number) =>
      request<ReportView>(`/admin/reports/${id(reportId)}/claim`, "POST", {
        version,
      }),
    transitionReport: (
      reportId: string,
      status: string,
      resolutionCode: string,
      note: string,
      version: number,
    ) =>
      request<ReportView>(
        `/admin/reports/${id(reportId)}/transitions`,
        "POST",
        { status, resolutionCode, note, version },
      ),
    lockUser: (userId: string, locked: boolean, reason: string) =>
      request<number>(
        `/admin/users/${id(userId)}/${locked ? "lock" : "unlock"}`,
        "POST",
        { reason },
      ),
  };
}
