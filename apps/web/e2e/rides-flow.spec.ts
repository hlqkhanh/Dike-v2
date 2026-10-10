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
});

test("creates a draft from an owned route before publishing", async ({
  page,
}) => {
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
