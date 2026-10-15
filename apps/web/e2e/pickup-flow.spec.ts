import { expect, test } from "@playwright/test";

const post = {
  id: "pickup-post",
  ownerId: "driver",
  ownerDisplayName: "Linh Nguyễn",
  ownerAvatarUrl: null,
  type: "OFFER_RIDE",
  status: "OPEN",
  visibility: "PUBLIC",
  version: 1,
  termsVersion: 1,
  originLabel: "Hà Đông, Hà Nội",
  destinationLabel: "Keangnam, Hà Nội",
  vehicleType: "CAR",
  departureAt: "2026-10-15T01:00:00Z",
  expiresAt: "2026-10-15T02:00:00Z",
  remainingSeats: 2,
  contributionPerKm: 1000,
  note: "Đón cùng tuyến",
};
const pickup = {
  placeRef: "resolved-pickup",
  longitude: 105.78,
  latitude: 21.0,
  displayLabel: "Cổng trường, Nguyễn Trãi, Hà Nội",
};
const result = {
  id: "server-pickup-check",
  postId: post.id,
  passengerId: "passenger",
  tripId: "trip",
  postVersion: 1,
  tripVersion: 1,
  tripRouteVersion: 0,
  routeId: "route",
  pickup,
  destinationLabel: post.destinationLabel,
  readyAt: post.departureAt,
  latestPickupAt: "2026-10-15T02:00:00Z",
  pickupAt: "2026-10-15T01:10:00Z",
  arrivalAt: "2026-10-15T01:30:00Z",
  extraMeters: 700,
  extraSeconds: 180,
  maxExtraMeters: 1000,
  maxExtraSeconds: 300,
  compatible: true,
  pickupIndex: 1,
  reason: "COMPATIBLE",
  geometry: [
    { longitude: 105.77, latitude: 20.98 },
    { longitude: 105.78, latitude: 21.0 },
    { longitude: 105.79, latitude: 21.01 },
  ],
  provider: "GOONG",
  expiresAt: "2026-10-14T00:05:00Z",
};

test.beforeEach(async ({ page, context, baseURL }) => {
  await page.clock.setFixedTime(new Date("2026-10-14T00:00:00Z"));
  await context.addCookies([
    { name: "XSRF-TOKEN", value: "csrf-pickup", url: baseURL! },
  ]);
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill({
      json: {
        authenticated: true,
        user: { id: "passenger", displayName: "Mai" },
        session: { id: "session" },
      },
    }),
  );
  await page.route("**/api/v1/notifications", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route("**/api/v1/realtime/tickets", (route) =>
    route.fulfill({ status: 503, json: {} }),
  );
  await page.route("**/api/v1/social/revision", (route) =>
    route.fulfill({ json: { revision: 1 } }),
  );
  await page.route("**/api/v1/friendships**", (route) =>
    route.fulfill({ json: { items: [], nextCursor: null } }),
  );
  await page.route("**/api/v1/ride-posts?**", (route) =>
    route.fulfill({ json: { items: [post], nextCursor: null } }),
  );
  await page.route("**/api/v1/ride-posts/pickup-post", (route) =>
    route.fulfill({ json: post }),
  );
  await page.route("**/api/v1/ride-posts/pickup-post/route", (route) =>
    route.fulfill({
      json: {
        geometry: [result.geometry[0], result.geometry[2]],
        distanceMeters: 4200,
        durationSeconds: 660,
        provider: "GOONG",
      },
    }),
  );
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
  await page.route("**/api/v1/routing/place-sessions", (route) =>
    route.fulfill({ json: { sessionToken: "place-session" } }),
  );
  await page.route("**/api/v1/routing/places?**", (route) =>
    route.fulfill({
      json: [
        { placeRef: "suggested-pickup", displayLabel: pickup.displayLabel },
      ],
    }),
  );
  await page.route("**/api/v1/routing/places/resolve", (route) =>
    route.fulfill({ json: pickup }),
  );
});

for (const entry of ["home", "detail"]) {
  test(`${entry}: checks a separate pickup before sending and invalidates edited inputs`, async ({
    page,
  }) => {
    let sent = 0;
    await page.route("**/api/v1/ride-posts/pickup-post/responses", (route) => {
      if (route.request().method() === "POST") {
        sent++;
        expect(route.request().postDataJSON()).toEqual({
          message: "Mình đợi ở cổng",
          pickupCheckId: result.id,
        });
        return route.fulfill({
          json: {
            id: "response",
            postId: post.id,
            action: "REQUEST_RIDE",
            status: "PENDING",
          },
        });
      }
      return route.fulfill({ json: [] });
    });
    await page.route(
      "**/api/v1/ride-posts/pickup-post/pickup-checks",
      (route) => {
        expect(route.request().postDataJSON()).toEqual({
          pickupPlaceRef: pickup.placeRef,
        });
        expect(route.request().headers()["x-xsrf-token"]).toBe("csrf-pickup");
        return route.fulfill({ json: result });
      },
    );
    await page.goto(
      entry === "home" ? "/home" : "/feed/pickup-post?action=respond",
    );
    if (entry === "home")
      await page.getByRole("button", { name: "Đi ké ngay" }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Đi ké cùng Linh Nguyễn" }),
    ).toBeVisible();
    const submit = dialog.getByRole("button", { name: "Gửi yêu cầu đi ké" });
    await expect(submit).toBeDisabled();
    await expect(dialog.locator("input")).toHaveCount(1);
    await expect(dialog.locator('input[type="datetime-local"]')).toHaveCount(0);
    await expect(dialog.locator(".maplibregl-marker")).toHaveCount(2);
    await expect(dialog.locator(".route-member-marker--a")).toHaveText("LN");
    await dialog.getByLabel("Điểm đón của bạn").fill("Nguyễn Trãi");
    if (entry === "home")
      await dialog
        .getByRole("button", { name: "Tìm địa điểm", exact: true })
        .click();
    else await dialog.getByLabel("Điểm đón của bạn").press("Enter");

    await dialog.getByRole("button", { name: pickup.displayLabel }).click();

    await expect(dialog.getByText("Tiện đường", { exact: true })).toBeVisible();
    await expect(dialog.getByText(/Thêm 0,7 km · 3 phút/)).toBeVisible();
    await expect(submit).toBeEnabled();
    await expect(dialog.locator(".maplibregl-marker")).toHaveCount(3);
    await expect(dialog.locator(".route-member-marker--b")).toHaveText("M");
    if (process.env.DIKE_TEST_LIVE_MAP && entry === "detail")
      await dialog.screenshot({
        path: `../../.tmp/pickup-redesign-${test.info().project.name}.png`,
      });
    expect(sent).toBe(0);
    await dialog.getByLabel("Điểm đón của bạn").fill("Nguyễn Trãi 2");
    await expect(submit).toBeDisabled();
    await dialog.getByLabel("Điểm đón của bạn").press("Enter");

    await dialog.getByRole("button", { name: pickup.displayLabel }).click();
    await expect(submit).toBeEnabled();
    await dialog
      .getByRole("textbox", { name: /Lời nhắn/ })
      .fill("Mình đợi ở cổng");
    await submit.click();
    await expect(dialog).toHaveCount(0);
    expect(sent).toBe(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}

test("does not permit requests exceeding driver detour limits", async ({
  page,
}) => {
  await page.route("**/api/v1/ride-posts/pickup-post/responses", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route("**/api/v1/ride-posts/pickup-post/pickup-checks", (route) =>
    route.fulfill({
      json: {
        ...result,
        compatible: false,
        reason: "DETOUR_EXCEEDED",
        extraMeters: 2200,
      },
    }),
  );
  await page.goto("/feed/pickup-post?action=respond");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Điểm đón của bạn").fill("Nguyễn Trãi");
  await dialog.getByLabel("Điểm đón của bạn").press("Enter");

  await dialog.getByRole("button", { name: pickup.displayLabel }).click();

  await expect(
    dialog.getByText("Điểm đón vượt mức ghé đón", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Gửi yêu cầu đi ké" }),
  ).toBeDisabled();
});

test("driver sees pickup evidence and cannot confirm an expired result", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill({
      json: {
        authenticated: true,
        user: { id: "driver", displayName: "Linh" },
        session: { id: "driver-session" },
      },
    }),
  );
  await page.route("**/api/v1/ride-posts/pickup-post/responses", (route) =>
    route.fulfill({
      json: [
        {
          id: "response",
          postId: post.id,
          requesterId: "passenger",
          ownerId: "driver",
          action: "REQUEST_RIDE",
          status: "PENDING",
          version: 0,
          message: "Mình đợi ở cổng",
          pickupCheck: { ...result, expiresAt: "2026-10-13T00:00:00Z" },
        },
      ],
    }),
  );
  await page.goto("/feed/pickup-post");
  const requests = page.locator(".feed-response-owner-panel");
  const request = requests.getByLabel(/Hiển thị tuyến đón của/);
  await expect(request).toBeVisible();
  await request.click();

  await expect(request).toHaveClass(/is-map-selected/);
  const routeCard = page.locator(".feed-detail-map-card");
  await expect(routeCard.locator(".post-route-map-canvas")).toBeVisible();
  await expect(routeCard.getByText("Điểm đón", { exact: true })).toBeVisible();
  await expect(routeCard.getByText(pickup.displayLabel)).toBeVisible();
  await expect(
    routeCard.getByText("Dự kiến đón", { exact: true }),
  ).toBeVisible();
  await expect(
    requests.getByRole("button", { name: "Xác nhận", exact: true }),
  ).toBeDisabled();
});
