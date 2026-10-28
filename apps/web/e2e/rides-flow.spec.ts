import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page, context, baseURL }) => {
  // These browser tests use mocked APIs; never fall through to a local backend.
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({
      status: 503,
      json: { error: { code: "E2E_API_NOT_MOCKED" } },
    }),
  );
  await page.route("**/api/v1/notifications", (route) =>
    route.fulfill({ json: [] }),
  );
  await context.addCookies([
    { name: "XSRF-TOKEN", value: "csrf-rides", url: baseURL! },
  ]);
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill({
      json: {
        authenticated: true,
        user: { id: "passenger", displayName: "Khách thử nghiệm" },
        session: { id: "session" },
      },
    }),
  );
  await page.route("**/api/v1/social/revision", (route) =>
    route.fulfill({ json: { revision: 1 } }),
  );
  await page.route("**/api/v1/notifications", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route("**/api/v1/friendships**", (route) =>
    route.fulfill({ json: { items: [], nextCursor: null } }),
  );
  await page.route("**/api/v1/ride-posts/*/route", (route) =>
    route.fulfill({ status: 404, json: {} }),
  );
  await page.route("**/api/v1/ride-posts/*/responses", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({ json: [] })
      : route.fallback(),
  );
  await page.route("**/api/v1/realtime/tickets", (route) =>
    route.fulfill({
      json: {
        ticket: "e2e-ticket",
        websocketUrl: "ws://127.0.0.1:1/realtime",
        expiresAt: "2099-01-01T00:00:00Z",
      },
    }),
  );
});

test("opening a demo post encodes its identifier once for detail and responses", async ({
  page,
}) => {
  const postId = "demo:member-id:post-offer";
  const post = {
    id: postId,
    ownerId: "passenger",
    ownerDisplayName: "Khách thử nghiệm",
    type: "OFFER_RIDE",
    status: "OPEN",
    visibility: "PUBLIC",
    originLabel: "Khu A",
    destinationLabel: "Khu B",
    vehicleType: "CAR",
    departureAt: "2026-10-14T01:00:00Z",
    expiresAt: "2026-10-15T01:00:00Z",
    note: "Đi cùng",
    version: 1,
    termsVersion: 1,
    remainingSeats: 2,
    contributionPerKm: 1000,
    pendingResponseCount: 0,
  };
  const requestedPaths: string[] = [];
  await page.route("**/api/v1/notifications", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route("**/api/v1/ride-posts?**", (route) =>
    route.fulfill({ json: { items: [post] } }),
  );
  await page.route("**/api/v1/ride-posts/*", (route) => {
    const path = new URL(route.request().url()).pathname;
    requestedPaths.push(path);
    return route.fulfill(
      path === `/api/v1/ride-posts/${encodeURIComponent(postId)}`
        ? { json: post }
        : {
            status: 400,
            json: { error: { message: "Incorrectly encoded post identifier" } },
          },
    );
  });
  await page.route("**/api/v1/ride-posts/*/responses", (route) => {
    requestedPaths.push(new URL(route.request().url()).pathname);
    return route.fulfill({ json: [] });
  });
  await page.goto("/home");
  await page.locator(".new-ride-card-link").click();
  await expect(page.locator(".feed-detail-card")).toBeVisible();
  await expect(
    page
      .locator(".feed-detail-author")
      .getByText("Khách thử nghiệm", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => requestedPaths)
    .toContain(`/api/v1/ride-posts/${encodeURIComponent(postId)}/responses`);
  expect(requestedPaths).toContain(
    `/api/v1/ride-posts/${encodeURIComponent(postId)}`,
  );
  expect(requestedPaths.some((path) => path.includes("%253A"))).toBe(false);
});

test("feed shows real author names and photos, preserving sample placeholders", async ({
  page,
}) => {
  await page.route("**/api/v1/notifications", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route("**/avatar-e2e.svg", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="green"/></svg>',
    }),
  );
  await page.route("**/api/v1/ride-posts/*/route", (route) =>
    route.fulfill({
      json: {
        geometry: [
          { latitude: 21.0285, longitude: 105.8542 },
          { latitude: 20.9802, longitude: 105.7851 },
        ],
        distanceMeters: 9200,
        durationSeconds: 1320,
        provider: "OSRM",
      },
    }),
  );
  const base = {
    type: "OFFER_RIDE",
    status: "OPEN",
    originLabel: "Khu A",
    destinationLabel: "Khu B",
    vehicleType: "CAR",
    departureAt: "2026-10-14T01:00:00Z",
    remainingSeats: 2,
  };
  await page.route("**/api/v1/ride-posts?**", (route) =>
    route.fulfill({
      json: {
        items: [
          {
            ...base,
            id: "real-photo",
            ownerId: "member-1",
            ownerDisplayName: "Linh Nguyễn",
            ownerAvatarUrl: "/avatar-e2e.svg",
          },
          {
            ...base,
            id: "real-initials",
            ownerId: "member-2",
            ownerDisplayName: "Mai Anh",
            ownerAvatarUrl: null,
          },
          { ...base, id: "demo-post", ownerId: "demo-user-missing" },
        ],
      },
    }),
  );
  await page.goto("/home");
  const cards = page.locator(".new-ride-card");
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0).locator("header strong")).toHaveText("Linh Nguyễn");
  await expect(cards.nth(0).locator(".member-avatar-image")).toHaveAttribute(
    "src",
    /\/avatar-e2e\.svg$/,
  );
  await expect
    .poll(() =>
      cards
        .nth(0)
        .locator(".member-avatar-image")
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(cards.nth(1).locator("header strong")).toHaveText("Mai Anh");
  await expect(cards.nth(1).locator(".new-ride-avatar")).toHaveText("MA");
  await expect(cards.nth(2).locator("header strong")).toHaveText(
    "Thành viên Diké",
  );
  await expect(cards.locator(".post-route-map-canvas")).toHaveCount(3);
});

test("feed filters by departure date and exposes contextual post actions", async ({
  page,
}) => {
  const posts = [
    {
      id: "owned",
      ownerId: "passenger",
      ownerDisplayName: "Bài của tôi",
      type: "OFFER_RIDE",
      status: "OPEN",
      originLabel: "Điểm A",
      destinationLabel: "Điểm B",
      vehicleType: "CAR",
      departureAt: "2026-10-20T05:00:00Z",
      createdAt: "2026-10-15T05:00:00Z",
      version: 1,
      remainingSeats: 2,
      pendingResponseCount: 1,
    },
    {
      id: "other",
      ownerId: "other-member",
      ownerDisplayName: "Bài của người khác",
      type: "NEED_RIDE",
      status: "OPEN",
      originLabel: "Điểm C",
      destinationLabel: "Điểm D",
      vehicleType: "MOTORCYCLE",
      departureAt: "2026-10-21T05:00:00Z",
      createdAt: "2026-10-14T05:00:00Z",
      version: 0,
      pendingResponseCount: 0,
    },
  ];
  await page.route("**/api/v1/ride-posts?**", (route) =>
    route.fulfill({ json: { items: posts } }),
  );
  await page.route("**/api/v1/ride-posts/owned/close", (route) =>
    route.fulfill({ json: { ...posts[0], status: "CLOSED", version: 2 } }),
  );

  await page.goto("/home");
  const cards = page.locator(".new-ride-card");
  await expect(cards).toHaveCount(2);

  await page.getByRole("button", { name: "Mới nhất" }).click();
  await page.getByRole("menuitemradio", { name: "Cũ nhất" }).click();
  await expect(cards.first().locator("header strong")).toHaveText(
    "Bài của người khác",
  );

  await page.getByLabel("Lọc theo ngày khởi hành").fill("2026-10-20");
  await expect(cards).toHaveCount(1);
  await expect(cards.first().locator("header strong")).toHaveText(
    "Bài của tôi",
  );

  await cards
    .first()
    .getByRole("button", { name: "Mở tùy chọn bài đăng" })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "Ẩn khỏi bảng feed" }),
  ).toBeVisible();
  await page.getByRole("menuitem", { name: "Xóa bài đăng" }).click();
  await expect(cards).toHaveCount(0);
});

test("home feed scrolls over the stationary banner without scrolling the document", async ({
  page,
}) => {
  await page.route("**/api/v1/notifications", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route("**/api/v1/ride-posts?**", (route) =>
    route.fulfill({
      json: {
        items: Array.from({ length: 12 }, (_, index) => ({
          id: `home-post-${index}`,
          type: index % 2 === 0 ? "OFFER_RIDE" : "NEED_RIDE",
          status: "OPEN",
          originLabel: "Khu A",
          destinationLabel: "Khu B",
          vehicleType: "CAR",
          departureAt: "2026-10-14T01:00:00Z",
          note: "Đi cùng",
          remainingSeats: 2,
        })),
      },
    }),
  );
  await page.goto("/home");
  await expect(page.locator(".new-ride-card")).toHaveCount(12);
  const greeting = page.getByRole("heading", { name: "Chào bạn!" });
  const initialGreeting = await greeting.boundingBox();
  const feed = page.locator(".new-feed-section");
  const initialFeed = await feed.boundingBox();
  const scrollArea = page.getByRole("main", { name: "Trang chủ Diké" });
  const roleCards = page.locator(".new-home-cards-row");
  await expect(roleCards).toHaveCSS("opacity", "1");
  await scrollArea.evaluate((element) => {
    element.scrollTop = 90;
  });
  await expect(roleCards).toHaveCSS("opacity", "1");
  await expect(roleCards).not.toHaveAttribute("inert", "");
  await scrollArea.focus();
  await scrollArea.press("PageDown");
  await expect
    .poll(() => scrollArea.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(100);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect
    .poll(async () => (await greeting.boundingBox())!.y)
    .toBeCloseTo(initialGreeting!.y, 0);
  await expect
    .poll(async () => (await feed.boundingBox())!.y)
    .toBeLessThan(initialFeed!.y - 100);
  await expect(page.locator(".new-app-header")).toHaveClass(/scrolled/);
  await expect(roleCards).toHaveAttribute("aria-hidden", "true");
  await expect(roleCards).toHaveAttribute("inert", "");
  await scrollArea.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(page.locator(".new-home-footer")).toBeInViewport();
  await scrollArea.evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect(roleCards).toHaveCSS("opacity", "1");
  await expect(roleCards).not.toHaveAttribute("inert", "");
});

test("shows a matched post response above the feed and removes its post card", async ({
  page,
}) => {
  const post = {
    id: "matched-post",
    ownerId: "driver-other",
    ownerDisplayName: "Quốc Khánh Hồ Lê",
    type: "OFFER_RIDE",
    status: "MATCHED",
    visibility: "PUBLIC",
    communityId: null,
    originLabel: "Đại học FPT Quy Nhơn",
    destinationLabel: "Quy Nhơn, Bình Định",
    vehicleType: "MOTORCYCLE",
    departureAt: "2026-10-22T00:30:00Z",
    expiresAt: "2026-10-22T01:30:00Z",
    note: "Đi cùng",
    version: 0,
    termsVersion: 0,
    remainingSeats: 1,
    contributionPerKm: 500,
  };
  await page.route("**/api/v1/bookings**", (route) =>
    route.fulfill({
      json: {
        items: [],
        nextCursor: null,
      },
    }),
  );
  await page.route("**/api/v1/trips/trip-home", (route) =>
    route.fulfill({
      json: {
        id: "trip-home",
        driverId: "driver-other",
        status: "OPEN",
        vehicleType: "MOTORCYCLE",
        originLabel: "Đại học FPT Quy Nhơn",
        destinationLabel: "Quy Nhơn, Bình Định",
        departureAt: "2026-10-22T00:30:00Z",
        arrivalAt: "2026-10-22T01:15:00Z",
        offeredSeats: 4,
        remainingSeats: 1,
        contributionPerKm: 500,
        visibility: "PUBLIC",
        communityId: null,
        version: 0,
        termsVersion: 0,
        routeVersion: 0,
      },
    }),
  );
  await page.route("**/api/v1/users/driver-other", (route) =>
    route.fulfill({
      json: {
        userId: "driver-other",
        displayName: "Quốc Khánh Hồ Lê",
        bio: "",
        avatarUrl: "",
        verified: true,
      },
    }),
  );
  await page.route("**/api/v1/ride-posts?**", (route) =>
    route.fulfill({ json: { items: [post], nextCursor: null } }),
  );
  await page.route("**/api/v1/ride-posts/matched-post", (route) =>
    route.fulfill({ json: post }),
  );
  await page.route("**/api/v1/ride-post-responses/active", (route) =>
    route.fulfill({
      json: [
        {
          id: "accepted-response",
          postId: post.id,
          requesterId: "passenger",
          requesterDisplayName: "Khách thử nghiệm",
          requesterAvatarUrl: null,
          companionPhone: "+84901234567",
          ownerId: post.ownerId,
          action: "OFFER_RIDE",
          status: "ACCEPTED",
          message: "",
          conversationId: "conversation-home",
          createdAt: "2026-10-19T00:00:00Z",
          updatedAt: "2026-10-19T00:00:00Z",
          version: 1,
        },
      ],
    }),
  );
  await page.route("**/api/v1/ride-posts/matched-post/responses", (route) =>
    route.fulfill({
      json: [
        {
          id: "accepted-response",
          postId: post.id,
          requesterId: "passenger",
          requesterDisplayName: "Khách thử nghiệm",
          requesterAvatarUrl: null,
          companionPhone: "+84901234567",
          ownerId: post.ownerId,
          action: "OFFER_RIDE",
          status: "ACCEPTED",
          message: "",
          conversationId: "conversation-home",
          createdAt: "2026-10-19T00:00:00Z",
          updatedAt: "2026-10-19T00:00:00Z",
          version: 1,
        },
      ],
    }),
  );
  let nextDecision: unknown;
  await page.route(
    "**/api/v1/ride-post-responses/accepted-response/decision",
    async (route) => {
      nextDecision = route.request().postDataJSON();
      await route.fulfill({
        json: {
          id: "accepted-response",
          postId: post.id,
          requesterId: "passenger",
          requesterDisplayName: "Khách thử nghiệm",
          requesterAvatarUrl: null,
          companionPhone: "+84901234567",
          ownerId: post.ownerId,
          action: "OFFER_RIDE",
          status: "DRIVER_STARTED",
          message: "",
          conversationId: "conversation-home",
          createdAt: "2026-10-19T00:00:00Z",
          updatedAt: "2026-10-19T00:01:00Z",
          version: 2,
        },
      });
    },
  );

  await page.goto("/home");
  const matchedCard = page.locator(".matched-ride-card");
  await expect(matchedCard).toBeVisible();
  await expect(
    matchedCard.getByRole("heading", { name: "Quốc Khánh Hồ Lê" }),
  ).toBeVisible();
  await expect(
    matchedCard.getByText("Khởi hành", { exact: true }),
  ).toBeVisible();
  await expect(
    matchedCard.getByRole("link", { name: /Xem chi tiết/ }),
  ).toHaveAttribute("href", "/feed/matched-post");
  await expect(
    matchedCard.getByRole("link", { name: "Gọi điện qua SMS" }),
  ).toHaveAttribute("href", "sms:+84901234567");
  await matchedCard.getByRole("button", { name: "Đến đón" }).click();
  await expect
    .poll(() => nextDecision)
    .toEqual({
      version: 1,
      decision: "DRIVER_STARTED",
    });
  await expect(page.locator(".new-ride-card")).toHaveCount(0);
  await expect(page.locator(".matched-ride-card-art")).toHaveCSS(
    "background-image",
    /complete_ride_card\.png/,
  );

  const roleCards = await page.locator(".new-home-cards-row").boundingBox();
  const matchBounds = await matchedCard.boundingBox();
  const feedHeading = await page
    .getByRole("heading", { name: "Bảng feed" })
    .boundingBox();
  expect(matchBounds!.y).toBeGreaterThan(roleCards!.y + roleCards!.height);
  expect(feedHeading!.y).toBeGreaterThan(matchBounds!.y + matchBounds!.height);
});

test("confirms an offer to carry before sending it to the post owner", async ({
  page,
}) => {
  const post = {
    id: "post-response",
    ownerId: "driver-other",
    type: "NEED_RIDE",
    status: "OPEN",
    visibility: "PUBLIC",
    communityId: null,
    originLabel: "FPT, 101 Láng Hạ, Đống Đa, Hà Nội",
    destinationLabel: "Keangnam Landmark 72, Nam Từ Liêm, Hà Nội",
    vehicleType: "CAR",
    departureAt: "2026-10-15T01:00:00Z",
    expiresAt: "2026-10-15T02:00:00Z",
    note: "Đi đúng giờ",
    version: 0,
    termsVersion: 0,
    remainingSeats: 2,
    contributionPerKm: 500,
  };
  let responses: unknown[] = [];
  await page.route("**/api/v1/ride-posts/post-response", (route) =>
    route.fulfill({ json: post }),
  );
  await page.route(
    "**/api/v1/ride-posts/post-response/responses",
    async (route) => {
      if (route.request().method() === "POST") {
        responses = [
          {
            id: "response-1",
            postId: post.id,
            requesterId: "passenger",
            ownerId: post.ownerId,
            action: "OFFER_RIDE",
            status: "PENDING",
            createdAt: "2026-10-14T03:00:00Z",
            updatedAt: "2026-10-14T03:00:00Z",
            version: 0,
          },
        ];
        await route.fulfill({ json: responses[0] });
        return;
      }
      await route.fulfill({ json: responses });
    },
  );

  await page.goto("/feed/post-response?action=respond");
  await expect(
    page.getByRole("heading", { name: "Xác nhận muốn chở thành viên này?" }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText(post.originLabel),
  ).toBeVisible();

  await page.getByRole("button", { name: "Gửi yêu cầu" }).click();
  await expect(page.getByText("Đang chờ người đăng xác nhận")).toBeVisible();
});

test("draft trip detail continues the creation flow and publishes once", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-13T00:00:00Z"));
  let opened = false;
  let openCalls = 0;
  const trip = {
    id: "draft-trip",
    driverId: "passenger",
    status: "DRAFT",
    vehicleType: "MOTORCYCLE",
    originLabel: "Đại học Bách Khoa",
    destinationLabel: "Đại học Kinh tế",
    departureAt: "2026-10-13T01:00:00Z",
    arrivalAt: "2026-10-13T01:30:00Z",
    offeredSeats: 1,
    remainingSeats: 1,
    contributionPerKm: 500,
    visibility: "PUBLIC",
    communityId: "",
    version: 0,
    termsVersion: 0,
    routeVersion: 0,
  };
  await page.route("**/api/v1/trips/draft-trip/open", async (route) => {
    openCalls++;
    expect(route.request().postDataJSON()).toEqual({ version: 0 });
    expect(route.request().headers()["idempotency-key"]).toBeTruthy();
    opened = true;
    await route.fulfill({ json: { ...trip, status: "OPEN", version: 1 } });
  });
  await page.route("**/api/v1/trips/draft-trip", (route) =>
    route.fulfill({
      json: opened ? { ...trip, status: "OPEN", version: 1 } : trip,
    }),
  );

  await page.goto("/trips/draft-trip");
  await expect(
    page.getByRole("heading", { name: "Kiểm tra và đăng chuyến" }),
  ).toBeVisible();
  await expect(page.getByText("Chuyến đang ở chế độ bản nháp")).toBeVisible();
  await expect(page.getByText("Đại học Bách Khoa")).toBeVisible();
  await page.getByRole("button", { name: "Đăng chuyến" }).click();
  await expect(page.getByText("Đang mở", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Đăng chuyến" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Bắt đầu chuyến" }),
  ).toBeDisabled();
  await expect(page.getByText(/15 phút trước giờ khởi hành/)).toBeVisible();
  expect(openCalls).toBe(1);
});

test("feed provides unavailable state and never retains a denied post after refresh", async ({
  page,
}) => {
  let hidden = false;
  await page.route("**/api/v1/ride-capabilities", (route) =>
    route.fulfill({
      json: {
        posting: false,
        trips: false,
        proposals: false,
        message: "Tính năng tạo chuyến đang được chuẩn bị.",
      },
    }),
  );
  await page.route("**/api/v1/ride-posts?**", (route) =>
    route.fulfill({
      json: {
        items: hidden
          ? []
          : [
              {
                id: "post",
                ownerId: "driver",
                type: "OFFER_RIDE",
                status: "OPEN",
                visibility: "PUBLIC",
                originLabel: "Bến xe phía Bắc",
                destinationLabel: "Trường đại học",
                vehicleType: "CAR",
                departureAt: "2026-10-08T01:00:00Z",
                expiresAt: "2026-10-08T01:00:00Z",
                note: "Đi cùng buổi sáng",
                version: 1,
                termsVersion: 0,
                remainingSeats: 1,
                contributionPerKm: 1000,
              },
            ],
        nextCursor: null,
      },
    }),
  );
  await page.goto("/home");
  await expect(
    page.getByText("Tính năng tạo chuyến đang được chuẩn bị."),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Bến xe phía Bắc → Trường đại học" }),
  ).toBeVisible();
  hidden = true;
  await page.reload();
  await expect(page.getByText("Chưa có bài đăng để hiển thị.")).toBeVisible();
  await expect(page.getByText("Đi cùng buổi sáng")).toHaveCount(0);
});

test("accepting an offer sends the displayed version and creates no second confirmation", async ({
  page,
}) => {
  let accepted = false;
  let calls = 0;
  const proposal = {
    id: "p",
    postId: "post",
    tripId: "trip",
    senderId: "driver",
    recipientId: "passenger",
    status: "PENDING",
    priceVnd: 25000,
    pickupAt: "2026-10-08T01:00:00Z",
    dropoffAt: "2026-10-08T02:00:00Z",
    expiresAt: "2026-10-08T00:59:00Z",
    version: 3,
  };
  await page.route("**/api/v1/proposals", (route) =>
    route.fulfill({
      json: {
        items: [
          {
            ...proposal,
            status: accepted ? "ACCEPTED" : "PENDING",
            version: accepted ? 4 : 3,
          },
        ],
        nextCursor: null,
      },
    }),
  );
  await page.route("**/api/v1/proposals/p/accept", async (route) => {
    calls++;
    expect(route.request().postDataJSON()).toEqual({ version: 3 });
    expect(route.request().headers()["idempotency-key"]).toBeTruthy();
    expect(route.request().headers()["x-xsrf-token"]).toBe("csrf-rides");
    accepted = true;
    await route.fulfill({ json: { id: "b", status: "CONFIRMED" } });
  });
  await page.goto("/proposals");
  await page.getByRole("button", { name: "Đồng ý đi cùng" }).click();
  await expect(
    page.getByRole("link", { name: "Xem booking", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Đồng ý đi cùng" }),
  ).toHaveCount(0);
  expect(calls).toBe(1);
});

test("boarding code is fetched only on request and can be hidden", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/api/v1/bookings/b", (route) =>
    route.fulfill({
      json: {
        id: "b",
        tripId: "t",
        passengerId: "passenger",
        driverId: "driver",
        status: "CONFIRMED",
        priceVnd: 25000,
        pickupAt: "2026-10-08T01:00:00Z",
        dropoffAt: "2026-10-08T02:00:00Z",
        version: 0,
      },
    }),
  );
  await page.route("**/api/v1/bookings/b/boarding-code", (route) => {
    requests++;
    return route.fulfill({ json: { code: "012345" } });
  });
  await page.goto("/bookings/b");
  await expect(
    page.getByRole("button", { name: "Xem mã lên xe" }),
  ).toBeVisible();
  expect(requests).toBe(0);
  await page.getByRole("button", { name: "Xem mã lên xe" }).click();
  await expect(page.getByText("012345", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Xác nhận lên xe" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Ẩn mã lên xe" }).click();
  await expect(page.getByText("012345", { exact: true })).toHaveCount(0);
  expect(requests).toBe(1);
});

test("active journey supports payment acknowledgement and consented location sharing", async ({
  page,
  context,
}) => {
  let paid = false;
  let consented = false;
  let locationUpdates = 0;
  await context.grantPermissions(["geolocation"], {
    origin: "http://127.0.0.1:3100",
  });
  await context.setGeolocation({ latitude: 10.7769, longitude: 106.7009 });
  await page.route("**/api/v1/bookings/live", (route) =>
    route.fulfill({
      json: {
        id: "live",
        tripId: "trip-live",
        passengerId: "passenger",
        driverId: "driver",
        status: "IN_PROGRESS",
        priceVnd: 30000,
        pickupAt: "2026-10-08T01:00:00Z",
        dropoffAt: "2026-10-08T02:00:00Z",
        reason: "",
        version: 2,
      },
    }),
  );
  await page.route("**/api/v1/bookings/live/payment-acknowledgement", (route) =>
    route.fulfill({
      json: {
        bookingId: "live",
        amountVnd: 30000,
        passengerPaidAt: paid ? "2026-10-08T02:05:00Z" : null,
        driverReceivedAt: null,
        status: paid ? "PASSENGER_REPORTED_PAID" : "NONE",
        locked: false,
        bankVerified: false,
        version: paid ? 1 : 0,
      },
    }),
  );
  await page.route("**/api/v1/bookings/live/payment", (route) =>
    route.fulfill({
      json: {
        bookingId: "live",
        amountVnd: 30000,
        status: "UNAVAILABLE",
        providerAvailable: false,
        bankVerified: false,
        version: 0,
      },
    }),
  );
  await page.route(
    "**/api/v1/bookings/live/payment-acknowledgement/paid",
    (route) => {
      paid = route.request().method() === "PUT";
      return route.fulfill({ json: {} });
    },
  );
  await page.route("**/api/v1/bookings/live/live-location-consent", (route) => {
    consented = route.request().method() === "PUT";
    return route.fulfill({ status: 204 });
  });
  await page.route("**/api/v1/bookings/live/live-location", (route) => {
    if (route.request().method() === "PUT") {
      expect(consented).toBe(true);
      locationUpdates++;
      return route.fulfill({ json: {} });
    }
    return route.fulfill({ json: { locations: [] } });
  });
  await page.route("**/api/v1/bookings/live/review-eligibility", (route) =>
    route.fulfill({
      json: { bookingId: "live", eligible: false, submitted: false },
    }),
  );
  await page.route("**/api/v1/bookings/live/reviews", (route) =>
    route.fulfill({ json: [] }),
  );

  await page.goto("/bookings/live");
  await page.getByRole("button", { name: "Tôi đã trả tiền mặt" }).click();
  await expect(page.getByText("Chờ tài xế xác nhận")).toBeVisible();
  await page.getByRole("button", { name: "Cho phép chia sẻ" }).click();
  await expect(page.getByText("Đang bật", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Gửi vị trí hiện tại" }).click();
  await expect.poll(() => locationUpdates).toBe(1);
});

test("completed journey submits one accessible review", async ({ page }) => {
  let submitted = false;
  let reviewCalls = 0;
  await page.route("**/api/v1/bookings/done", (route) =>
    route.fulfill({
      json: {
        id: "done",
        tripId: "trip-done",
        passengerId: "passenger",
        driverId: "driver",
        status: "COMPLETED",
        priceVnd: 25000,
        pickupAt: "2026-10-08T01:00:00Z",
        dropoffAt: "2026-10-08T02:00:00Z",
        reason: "",
        version: 4,
      },
    }),
  );
  await page.route("**/api/v1/bookings/done/payment-acknowledgement", (route) =>
    route.fulfill({
      json: {
        bookingId: "done",
        amountVnd: 25000,
        status: "CONFIRMED",
        locked: true,
        bankVerified: false,
        version: 2,
      },
    }),
  );
  await page.route("**/api/v1/bookings/done/review-eligibility", (route) =>
    route.fulfill({
      json: {
        bookingId: "done",
        eligible: !submitted,
        submitted,
        revieweeId: "driver",
        revieweeRole: "DRIVER",
        deadline: "2026-10-15T00:00:00Z",
      },
    }),
  );
  await page.route("**/api/v1/bookings/done/reviews", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route("**/api/v1/reviews", async (route) => {
    reviewCalls++;
    expect(route.request().postDataJSON()).toEqual({
      bookingId: "done",
      stars: 4,
      comment: "Chuyến đi an toàn",
    });
    submitted = true;
    await route.fulfill({ json: { id: "review-1" } });
  });

  await page.goto("/bookings/done");
  await page.getByRole("button", { name: "4 sao: Tốt" }).click();
  await page.getByLabel(/Nhận xét/).fill("Chuyến đi an toàn");
  await page.getByRole("button", { name: "Gửi đánh giá" }).click();
  await expect(page.getByText(/Đánh giá đã được gửi/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Gửi đánh giá" })).toHaveCount(
    0,
  );
  expect(reviewCalls).toBe(1);
});
