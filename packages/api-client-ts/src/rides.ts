import {
  createApiClientConfiguration,
  type ApiClientConfiguration,
} from "./configuration";
import { ApiError } from "./auth";
import type {
  PostSource,
  PostSourceCreate,
  RidePostRoute,
  PickupCheck,
  PickupCheckInput,
  DraftAgain,
  TripStops,
  RideDiscoveryInput,
  RideDiscoveryResults,
} from "./generated/schema";
import type {
  RidePostPage,
  RidePostView,
  TripPage,
  TripView,
  ProposalPage,
  ProposalView,
  BookingPage,
  BookingView,
  BoardingCode,
  BookingAction,
  TripAction,
  RideCapabilities,
  Report,
  RidePostCreate,
  TripCreate,
  ProposalCreate,
} from "./generated/schema";

export type PostReportInput = {
  postId: string;
  reason: string;
  note?: string;
};

export type RidePostResponse = {
  id: string;
  postId: string;
  requesterId: string;
  requesterDisplayName: string;
  requesterAvatarUrl: string | null;
  ownerId: string;
  action: "REQUEST_RIDE" | "OFFER_RIDE";
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";
  message: string;
  conversationId: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  pickupCheck?: PickupCheck | null;
};

export type CreateRidePostInput = Omit<RidePostCreate, "communityId"> & {
  communityId?: string;
};

export function createRideApi(configuration: ApiClientConfiguration) {
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
        .find((c) => c.startsWith("XSRF-TOKEN="))
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
        error?.error?.code ?? "RIDE_REQUEST_FAILED",
        error?.error?.message ?? "Không thể xử lý yêu cầu, vui lòng tải lại.",
      );
    }
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }
  const id = encodeURIComponent;
  const page = (cursor?: string) => (cursor ? `?cursor=${id(cursor)}` : "");
  return {
    discover: (body: RideDiscoveryInput) =>
      request<RideDiscoveryResults>("/ride-discovery", "POST", body),
    createSource: (body: PostSourceCreate, key: string) =>
      request<PostSource>("/ride-post-sources", "POST", body, key),
    findAgain: (bookingId: string, version: number, key: string) =>
      request<DraftAgain>(
        `/bookings/${id(bookingId)}/find-again`,
        "POST",
        { version },
        key,
      ),
    capabilities: () => request<RideCapabilities>("/ride-capabilities"),
    feed: (tab: string, cursor?: string) =>
      request<RidePostPage>(
        tab === "saved"
          ? `/saved-posts${page(cursor)}`
          : `/ride-posts?tab=${id(tab)}${cursor ? `&cursor=${id(cursor)}` : ""}`,
      ),
    post: (postId: string) =>
      request<RidePostView>(`/ride-posts/${id(postId)}`),
    postRoute: (postId: string) =>
      request<RidePostRoute>(`/ride-posts/${id(postId)}/route`),
    postResponses: (postId: string) =>
      request<RidePostResponse[]>(`/ride-posts/${id(postId)}/responses`),
    checkPickup: (postId: string, body: PickupCheckInput) =>
      request<PickupCheck>(
        `/ride-posts/${id(postId)}/pickup-checks`,
        "POST",
        body,
      ),
    createPostResponse: (
      postId: string,
      message = "",
      pickupCheckId?: string,
    ) =>
      request<RidePostResponse>(`/ride-posts/${id(postId)}/responses`, "POST", {
        message,
        pickupCheckId,
      }),
    decidePostResponse: (
      responseId: string,
      version: number,
      decision: "ACCEPTED" | "REJECTED" | "WITHDRAWN",
    ) =>
      request<RidePostResponse>(
        `/ride-post-responses/${id(responseId)}/decision`,
        "POST",
        { version, decision },
      ),
    createPost: (body: CreateRidePostInput, key: string) =>
      request<RidePostView>("/ride-posts", "POST", body, key),
    postAction: (
      postId: string,
      action: "publish" | "close",
      version: number,
      key: string,
    ) =>
      request<RidePostView>(
        `/ride-posts/${id(postId)}/${action}`,
        "POST",
        { version },
        key,
      ),
    save: (postId: string, saved: boolean) =>
      request<void>(`/saved-posts/${id(postId)}`, saved ? "PUT" : "DELETE"),
    report: (body: PostReportInput, key: string) =>
      request<Report>(
        "/reports",
        "POST",
        {
          targetType: "RIDE_POST",
          targetId: body.postId,
          reason: body.reason,
          note: body.note,
        },
        key,
      ),
    trips: (cursor?: string) => request<TripPage>(`/trips${page(cursor)}`),
    trip: (tripId: string) => request<TripView>(`/trips/${id(tripId)}`),
    stops: (tripId: string) => request<TripStops>(`/trips/${id(tripId)}/stops`),
    createTrip: (body: TripCreate, key: string) =>
      request<TripView>("/trips", "POST", body, key),
    openTrip: (tripId: string, version: number, key: string) =>
      request<TripView>(`/trips/${id(tripId)}/open`, "POST", { version }, key),
    tripAction: (tripId: string, body: TripAction, key: string) =>
      request<TripView>(`/trips/${id(tripId)}/actions`, "POST", body, key),
    proposals: (cursor?: string) =>
      request<ProposalPage>(`/proposals${page(cursor)}`),
    proposal: (proposalId: string) =>
      request<ProposalView>(`/proposals/${id(proposalId)}`),
    propose: (body: ProposalCreate, key: string) =>
      request<ProposalView>("/proposals", "POST", body, key),
    accept: (proposalId: string, version: number, key: string) =>
      request<BookingView>(
        `/proposals/${id(proposalId)}/accept`,
        "POST",
        { version },
        key,
      ),
    decide: (
      proposalId: string,
      action: "reject" | "withdraw",
      version: number,
      key: string,
    ) =>
      request<ProposalView>(
        `/proposals/${id(proposalId)}/${action}`,
        "POST",
        { version },
        key,
      ),
    bookings: (cursor?: string) =>
      request<BookingPage>(`/bookings${page(cursor)}`),
    booking: (bookingId: string) =>
      request<BookingView>(`/bookings/${id(bookingId)}`),
    boardingCode: (bookingId: string) =>
      request<BoardingCode>(`/bookings/${id(bookingId)}/boarding-code`),
    bookingAction: (bookingId: string, body: BookingAction, key: string) =>
      request<BookingView>(
        `/bookings/${id(bookingId)}/actions`,
        "POST",
        body,
        key,
      ),
  };
}
