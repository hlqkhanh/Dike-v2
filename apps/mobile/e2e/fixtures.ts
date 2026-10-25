import { expect, type Page } from "@playwright/test";

export const departure = new Date(Date.now() + 86_400_000).toISOString();
export const session = {
  authenticated: true,
  user: {
    id: "member",
    displayName: "Minh Anh",
    email: "minhanh@example.com",
    avatarUrl: "",
    phoneMasked: "+84***1234",
    phoneStatus: "VERIFIED",
    phoneVersion: 1,
    nextAction: "NONE",
    accessMode: "VERIFIED",
    authorities: ["APPROVED_DRIVER"],
    verificationEvidence: "NONE",
    driverApprovalEvidence: "NONE",
  },
  session: {
    id: "current-session",
    deviceLabel: "Dike Android",
    current: true,
    lastSeenAt: departure,
    absoluteExpiresAt: departure,
  },
};
export const post = {
  id: "post-1",
  ownerId: "other",
  ownerDisplayName: "Thu Hà",
  type: "OFFER_RIDE",
  status: "OPEN",
  visibility: "PUBLIC",
  originLabel: "Đại học FPT",
  destinationLabel: "Quận 1, TP. Hồ Chí Minh",
  vehicleType: "CAR",
  departureAt: departure,
  remainingSeats: 2,
  contributionPerKm: 1000,
  note: "Cùng đi học, cùng sống xanh.",
  pendingResponseCount: 0,
  version: 1,
};
export const trip = {
  id: "trip-1",
  driverId: "member",
  status: "OPEN",
  originLabel: post.originLabel,
  destinationLabel: post.destinationLabel,
  departureAt: departure,
  vehicleType: "CAR",
  remainingSeats: 2,
  offeredSeats: 3,
  version: 1,
};
export const schedule = {
  id: "schedule-1",
  name: "Lịch đi học",
  weekdays: ["MONDAY", "FRIDAY"],
  effectiveFrom: "2026-10-01",
  effectiveUntil: "2027-01-01",
  startLocalTime: "08:00",
  endLocalTime: "17:00",
  usualOrigin: { displayLabel: "Nhà" },
  activityPlace: { displayLabel: "Đại học FPT" },
  directions: ["OUTBOUND", "RETURN"],
  defaultTravelRole: "RIDER",
  visibility: "PRIVATE",
  activityCategory: "STUDY",
  status: "ACTIVE",
  version: 1,
  warnings: [],
};
export type Captured = {
  path: string;
  method: string;
  body: Record<string, unknown>;
  key?: string;
  version?: string;
};

export async function setup(
  page: Page,
  options: {
    nextAction?: string;
    failFeed?: boolean;
    failFirstMessage?: boolean;
    failFirstOpen?: boolean;
    expireNotifications?: boolean;
    authenticated?: boolean;
    paginatedFeed?: boolean;
    discoveryEmpty?: boolean;
    failDiscovery?: boolean;
    firstVisit?: boolean;
  } = {},
) {
  const captured: Captured[] = [];
  let sendCount = 0;
  let openCount = 0;
  let privacy = {
    profileVisibility: "MEMBERS",
    discoverableByName: true,
    allowMessageRequests: true,
    version: 2,
  };
  let messages: Record<string, unknown>[] = [];
  let nextAction = options.nextAction ?? "NONE";
  let phoneVersion = 1;
  let blocked = false;
  let booking = {
    id: "booking-1",
    tripId: "trip-1",
    driverId: "member",
    passengerId: "other",
    status: "CONFIRMED",
    version: 4,
    priceVnd: 20000,
    pickupAt: departure,
    dropoffAt: departure,
  };
  await page.addInitScript((authenticated) => {
    if (authenticated)
      window.sessionStorage.setItem(
        "dike.mobile.session",
        "test-session-000000000000000000000000",
      );
  }, options.authenticated !== false);
  if (!options.firstVisit)
    await page.addInitScript(() => {
      if (!window.sessionStorage.getItem("dike.places.member"))
        window.sessionStorage.setItem(
          "dike.places.member",
          JSON.stringify({ configured: true, recent: [] }),
        );
    });
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace("/api/v1", "");
    const method = req.method();
    const body = req.postDataJSON() ?? {};
    if (method !== "GET" && method !== "OPTIONS")
      captured.push({
        path,
        method,
        body,
        key: req.headers()["idempotency-key"],
        version: req.headers()["if-match"],
      });
    const respond = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*",
        },
        body: status === 204 ? "" : JSON.stringify(data),
      });
    if (method === "OPTIONS") return respond({}, 204);
    if (path === "/auth/session")
      return respond({
        ...session,
        user: { ...session.user, nextAction, phoneVersion },
      });
    if (path === "/auth/phone") {
      phoneVersion++;
      nextAction = "VERIFY_PHONE";
      return respond({
        ...session,
        user: { ...session.user, nextAction, phoneVersion },
      });
    }
    if (path === "/auth/otp")
      return respond({
        challengeId: "otp-1",
        status: "ACTIVE",
        maskedPhone: "+84***1234",
        expiresAt: departure,
        resendAfter: new Date(Date.now() - 1000).toISOString(),
      });
    if (path === "/auth/otp/otp-1/verify") {
      nextAction = "NONE";
      return respond(session);
    }
    if (path === "/auth/logout") return respond({}, 204);
    if (path === "/auth/sessions")
      return respond({
        sessions: [
          session.session,
          {
            ...session.session,
            id: "old-session",
            current: false,
            deviceLabel: "Máy tính cũ",
          },
        ],
      });
    if (path === "/ride-posts" && method === "GET")
      return options.failFeed
        ? respond({ error: { message: "Kết nối bị gián đoạn" } }, 503)
        : respond(
            url.searchParams.has("cursor")
              ? {
                  items: [
                    {
                      ...post,
                      id: "post-2",
                      ownerDisplayName: "Tuấn Minh",
                      type: "NEED_RIDE",
                    },
                  ],
                  nextCursor: null,
                }
              : {
                  items: [post],
                  nextCursor: options.paginatedFeed ? "page-2" : null,
                },
          );
    if (path === "/ride-post-responses/active") return respond([]);
    if (path === "/ride-post-responses")
      return respond({ items: [], nextCursor: null });
    if (path === "/ride-posts" && method === "POST")
      return respond({
        ...post,
        id: "new-post",
        ownerId: "member",
        type: body.type,
        status: "DRAFT",
      });
    if (path.endsWith("/pickup-checks"))
      return respond({
        id: "pickup-1",
        compatible: true,
        pickupAt: departure,
        pickup: { displayLabel: post.originLabel },
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
      });
    if (/\/ride-posts\/[^/]+\/responses$/.test(path))
      return respond(
        method === "GET" ? [] : { id: "response-1", status: "PENDING" },
      );
    if (/\/ride-posts\/[^/]+\/route$/.test(path))
      return respond({
        distanceMeters: 12000,
        durationSeconds: 1500,
        geometry: [],
      });
    if (/\/ride-posts\/[^/]+\/publish$/.test(path))
      return respond({ ...post, id: "new-post", ownerId: "member" });
    if (/\/ride-posts\/[^/]+$/.test(path))
      return respond(
        path.endsWith("new-post")
          ? { ...post, id: "new-post", ownerId: "member" }
          : post,
      );
    if (path === "/ride-capabilities")
      return respond({
        canCreateTrip: true,
        vehicles: [
          {
            id: "car-1",
            type: "CAR",
            displayName: "Xe của Minh Anh",
            passengerCapacity: 3,
          },
        ],
      });
    if (path === "/trips")
      return respond(
        method === "GET"
          ? { items: [trip], nextCursor: null }
          : { ...trip, id: "new-trip", status: "DRAFT" },
      );
    if (path.endsWith("/stops")) return respond({ items: [], routeVersion: 1 });
    if (/\/trips\/[^/]+\/(open|actions)$/.test(path)) {
      openCount++;
      if (options.failFirstOpen && openCount === 1)
        return respond(
          { error: { message: "Chưa mở được chuyến. Thử lại." } },
          503,
        );
      return respond({ ...trip, id: "new-trip" });
    }
    if (/\/trips\/[^/]+$/.test(path)) return respond(trip);
    if (path === "/bookings") return respond({ items: [], nextCursor: null });
    if (path === "/bookings/booking-1") return respond(booking);
    if (path === "/bookings/booking-1/actions") {
      booking = {
        ...booking,
        status: body.action === "ARRIVE" ? "DRIVER_ARRIVED" : "COMPLETED",
        version: 5,
      };
      return respond(booking);
    }
    if (path === "/ride-post-sources")
      return respond({ id: "source-1", version: 1 });
    if (path === "/routing/place-sessions")
      return respond({ sessionToken: "place-session", expiresAt: departure });
    if (path === "/routing/places")
      return respond([
        {
          placeRef: url.searchParams.get("query")!.includes("FPT")
            ? "origin-ref"
            : "dest-ref",
          mainText: url.searchParams.get("query"),
          secondaryText: "TP. Hồ Chí Minh",
        },
      ]);
    if (path === "/routing/places/resolve")
      return respond({
        placeRef: body.placeRef,
        displayLabel:
          body.placeRef === "origin-ref"
            ? post.originLabel
            : post.destinationLabel,
        publicAreaLabel: "TP. Hồ Chí Minh",
        latitude: body.placeRef === "origin-ref" ? 10.77 : 10.79,
        longitude: body.placeRef === "origin-ref" ? 106.7 : 106.72,
        resolvedAt: new Date().toISOString(),
      });
    if (path === "/routing/places/reverse")
      return respond({
        placeRef: `reverse-${body.latitude}-${body.longitude}`,
        displayLabel:
          Number(body.latitude) < 10.78
            ? post.originLabel
            : post.destinationLabel,
        publicAreaLabel: "TP. Hồ Chí Minh",
        latitude: body.latitude,
        longitude: body.longitude,
        resolvedAt: new Date().toISOString(),
      });
    if (path === "/routing/routes")
      return respond({
        id: "route-1",
        origin: {
          displayLabel: post.originLabel,
          publicAreaLabel: "Thủ Đức",
          latitude: 10.77,
          longitude: 106.7,
        },
        destination: {
          displayLabel: post.destinationLabel,
          publicAreaLabel: "Quận 1",
          latitude: 10.79,
          longitude: 106.72,
        },
        distanceMeters: 12000,
        durationSeconds: 1500,
        expiresAt: departure,
      });
    if (path === "/routing/estimates")
      return respond({
        amountVnd: 12000,
        suggestedPerKmVnd: 1000,
        sharedDistanceMeters: 12000,
        passengerSeats: 1,
      });
    if (path === "/ride-discovery") {
      if (options.failDiscovery)
        return respond({ error: { message: "Chưa thể tìm hành trình." } }, 503);
      return respond({
        items: options.discoveryEmpty
          ? []
          : [
              {
                post,
                pickupDistanceMeters: 350,
                destinationDistanceMeters: 600,
                timeDifferenceMinutes: 10,
              },
            ],
      });
    }
    if (path === "/me/profile")
      return respond({
        userId: "member",
        displayName: "Minh Anh",
        bio: "Cùng nhau đi xanh",
        version: 1,
      });
    if (path === "/me/privacy") {
      if (method === "PATCH") privacy = { ...privacy, ...body, version: 3 };
      return respond(privacy);
    }
    if (path === "/me/consents")
      return respond({
        requirements: [
          {
            type: "TERMS_OF_SERVICE",
            version: "1",
            accepted: true,
            documentUrl: "https://example.com/terms",
          },
        ],
        receipts: [],
      });
    if (path === "/notifications")
      return options.expireNotifications
        ? respond({ error: { message: "Phiên đăng nhập đã hết hạn" } }, 401)
        : respond([
            {
              id: "notification-1",
              title: "Hành trình mới",
              body: "Một người bạn cùng đường đang chờ bạn.",
              createdAt: departure,
              data: { postId: "post-1" },
            },
          ]);
    if (path.startsWith("/notifications/")) return respond({}, 204);
    if (path === "/schedules")
      return respond(method === "GET" ? [schedule] : schedule);
    if (path.startsWith("/schedules/")) return respond(schedule);
    const conversation = {
      id: "conversation-1",
      recipientDisplayName: "Thu Hà",
      participantIds: ["member", "other"],
      canSend: true,
      state: "OPEN",
      unreadCount: 1,
      version: 1,
    };
    if (path === "/conversations") return respond([conversation]);
    if (path.endsWith("/messages")) {
      if (method === "GET") return respond(messages);
      sendCount++;
      if (options.failFirstMessage && sendCount === 1)
        return respond({ error: { message: "Gửi thất bại. Thử lại." } }, 503);
      const message = {
        ...body,
        id: "message-1",
        senderId: "member",
        sequence: 1,
        createdAt: new Date().toISOString(),
        conversationId: "conversation-1",
      };
      messages = [message];
      return respond(message);
    }
    if (path.endsWith("/read")) return respond({}, 204);
    if (path.startsWith("/conversations/")) return respond(conversation);
    if (path.endsWith("/ratings") || path.endsWith("/reviews"))
      return respond([]);
    if (path.startsWith("/users/"))
      return respond({
        userId: "other",
        displayName: "Thu Hà",
        bio: "Đi chung, sống xanh",
        verified: true,
      });
    if (path.startsWith("/friendships/users/"))
      return respond({ userId: "other", blockedByMe: blocked });
    if (path === "/blocks/other") {
      blocked = method === "PUT";
      return respond({ userId: "other", blockedByMe: blocked });
    }
    if (path === "/reports")
      return respond({ id: "report-1", status: "RECEIVED" });
    return respond(
      { error: { message: `Unhandled test API ${method} ${path}` } },
      500,
    );
  });
  return captured;
}

export async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
