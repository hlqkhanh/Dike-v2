import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill({
      json: {
        authenticated: true,
        user: { id: "viewer", displayName: "Người xem" },
        session: { id: "session" },
      },
    }),
  );
  await page.route("**/api/v1/realtime/tickets", (route) =>
    route.fulfill({ status: 503, json: {} }),
  );
  await page.route("**/api/v1/notifications", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route("**/api/v1/social/revision", (route) =>
    route.fulfill({ json: { revision: 1 } }),
  );
  await page.route("**/api/v1/friendships**", (route) =>
    route.fulfill({ json: { items: [], nextCursor: null } }),
  );
  await page.route("**/api/v1/ride-posts/route-post", (route) =>
    route.fulfill({
      json: {
        id: "route-post",
        ownerId: "owner",
        ownerDisplayName: "Linh Nguyễn",
        type: "OFFER_RIDE",
        status: "OPEN",
        visibility: "PUBLIC",
        version: 1,
        termsVersion: 1,
        remainingSeats: 2,
        originLabel: "Hà Đông, Hà Nội",
        destinationLabel: "Keangnam, Hà Nội",
        vehicleType: "CAR",
        departureAt: "2026-10-15T09:00:00Z",
        expiresAt: "2026-10-15T10:00:00Z",
        note: "",
      },
    }),
  );
  await page.route("**/api/v1/ride-posts/route-post/responses", (route) =>
    route.fulfill({ json: [] }),
  );
});

test("shows saved route on a free map without recalculating directions", async ({
  page,
}) => {
  let directionsCalls = 0;
  page.on("request", (request) => {
    if (/rsapi\.goong\.io|\/routing\/routes/.test(request.url()))
      directionsCalls++;
  });
  await page.route("**/api/v1/ride-posts/route-post/route", (route) =>
    route.fulfill({
      json: {
        geometry: [
          { longitude: 105.775, latitude: 20.98 },
          { longitude: 105.779, latitude: 20.99 },
          { longitude: 105.775, latitude: 21.017 },
        ],
        distanceMeters: 4200,
        durationSeconds: 660,
        provider: "GOONG",
      },
    }),
  );
  // Isolate network availability while exercising the real WebGL renderer and route layer.
  if (!process.env.DIKE_TEST_LIVE_MAP)
    await page.route("https://tiles.openfreemap.org/styles/positron", (route) =>
      route.fulfill({
        json: {
          version: 8,
          sources: {},
          layers: [
            {
              id: "background",
              type: "background",
              paint: { "background-color": "#eaf5ef" },
            },
          ],
        },
      }),
    );
  await page.goto("/feed/route-post");
  await expect(page.getByText("4,2 km", { exact: true })).toBeVisible();
  await expect(page.getByText("Khoảng 11 phút", { exact: true })).toBeVisible();
  const map = page.getByRole("region", { name: /Bản đồ tuyến đường/ });
  await map.scrollIntoViewIfNeeded();
  await expect(map.locator(".maplibregl-marker")).toHaveCount(2);
  await map.locator(".maplibregl-marker").first().click();
  await expect(map.locator(".maplibregl-popup-content")).toContainText(
    "Hà Đông, Hà Nội",
  );
  await expect(map.locator("canvas")).toBeVisible();
  expect(directionsCalls).toBe(0);
  if (process.env.DIKE_TEST_LIVE_MAP)
    await page
      .locator(".feed-detail-map-card")
      .screenshot({ path: "../../.tmp/post-route-preview.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("missing route shows a clear fallback without calling directions", async ({
  page,
}) => {
  await page.route("**/api/v1/ride-posts/route-post/route", (route) =>
    route.fulfill({
      status: 404,
      json: {
        error: {
          code: "POST_ROUTE_NOT_FOUND",
          message: "Saved route not found",
        },
      },
    }),
  );
  await page.goto("/feed/route-post");
  await expect(
    page.getByText("Bài đăng này chưa có tuyến đường được lưu."),
  ).toBeVisible();
  await expect(page.locator(".post-route-map-canvas")).toHaveCount(0);
});

test("waits for another viewer's route calculation and then displays its saved result", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/api/v1/ride-posts/route-post/route", (route) => {
    requests++;
    return requests === 1
      ? route.fulfill({
          status: 503,
          json: {
            error: { code: "POST_ROUTE_CALCULATING", message: "Calculating" },
          },
        })
      : route.fulfill({
          json: {
            geometry: [
              { longitude: 105.77, latitude: 20.98 },
              { longitude: 105.78, latitude: 21.01 },
            ],
            distanceMeters: 4200,
            durationSeconds: 660,
            provider: "GOONG",
          },
        });
  });
  await page.route("https://tiles.openfreemap.org/styles/positron", (route) =>
    route.fulfill({
      json: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#eaf5ef" },
          },
        ],
      },
    }),
  );
  await page.goto("/feed/route-post");
  await expect(page.getByText("Đang chuẩn bị tuyến đường…")).toBeVisible();
  await expect(page.getByText("4,2 km", { exact: true })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.locator(".maplibregl-marker")).toHaveCount(2);
  expect(requests).toBe(2);
});
