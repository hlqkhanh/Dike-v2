import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page, context }) => {
  await context.addCookies([
    { name: "XSRF-TOKEN", value: "csrf-rides", url: "http://127.0.0.1:3100" },
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

test("creates a draft from an owned route before publishing", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-07T00:00:00Z"));
  const draft = {
    id: "draft",
    ownerId: "passenger",
    type: "NEED_RIDE",
    status: "DRAFT",
    visibility: "FRIENDS",
    originLabel: "Khu A",
    destinationLabel: "Khu B",
    vehicleType: "CAR",
    departureAt: "2026-10-08T01:00:00Z",
    expiresAt: "2026-10-08T02:00:00Z",
    note: "Đi cùng",
    version: 0,
    termsVersion: 0,
  };
  let created = false;
  await page.route("**/api/v1/routing/routes/route-1", (route) =>
    route.fulfill({
      json: {
        id: "route-1",
        origin: { publicAreaLabel: "Khu A" },
        destination: { publicAreaLabel: "Khu B" },
      },
    }),
  );
  await page.route("**/api/v1/ride-post-sources", (route) => {
    expect(route.request().postDataJSON().routeId).toBe("route-1");
    return route.fulfill({ json: { id: "intent-1", version: 0 } });
  });
  await page.route("**/api/v1/ride-posts", (route) => {
    expect(route.request().postDataJSON()).toEqual({
      type: "NEED_RIDE",
      sourceId: "intent-1",
      sourceVersion: 0,
      visibility: "FRIENDS",
      note: "Đi cùng",
    });
    created = true;
    return route.fulfill({ json: draft });
  });
  await page.route("**/api/v1/ride-posts/draft", (route) =>
    route.fulfill({ json: draft }),
  );
  await page.goto("/feed/new?route=route-1");
  await page.getByLabel("Có thể đi từ").fill("2026-10-08T08:00");
  await page.getByLabel("Cần đến trước").fill("2026-10-08T10:00");
  await page.getByLabel("Thông tin bổ sung").fill("Đi cùng");
  await page.getByRole("button", { name: "Lưu và xem bản nháp" }).click();
  await expect(page).toHaveURL(/\/feed\/draft$/);
  await expect(
    page.getByRole("button", { name: "Đăng bài", exact: true }),
  ).toBeVisible();
  expect(created).toBe(true);
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
  await page.goto("/feed");
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
        status: paid ? "PASSENGER_PAID" : "PENDING",
        locked: false,
        bankVerified: false,
        version: paid ? 1 : 0,
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
  await page.getByRole("button", { name: "Xác nhận đã thanh toán" }).click();
  await expect(page.getByText("Hành khách đã thanh toán")).toBeVisible();
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
