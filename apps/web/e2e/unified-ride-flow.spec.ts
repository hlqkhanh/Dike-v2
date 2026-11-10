import { expect, test, type Page } from "@playwright/test";

const start = {
  placeRef: "start",
  displayLabel: "Hà Đông, Hà Nội",
  publicAreaLabel: "Hà Đông",
  longitude: 105.775,
  latitude: 20.98,
};
const end = {
  placeRef: "end",
  displayLabel: "Keangnam, Hà Nội",
  publicAreaLabel: "Nam Từ Liêm",
  longitude: 105.779,
  latitude: 21.017,
};
const savedRoute = {
  id: "route",
  provider: "GOONG",
  vehicleMode: "MOTORBIKE",
  origin: start,
  destination: end,
  distanceMeters: 4200,
  durationSeconds: 660,
  geometry: [start, { longitude: 105.78, latitude: 20.99 }, end],
  calculatedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
};
const samplePost = {
  id: "candidate",
  ownerId: "other",
  ownerDisplayName: "Nguyễn Linh",
  type: "NEED_RIDE",
  status: "OPEN",
  visibility: "PUBLIC",
  originLabel: "Điểm đón trên đường",
  destinationLabel: "Điểm đến gần bạn",
  vehicleType: "MOTORCYCLE",
  departureAt: new Date(Date.now() + 3600000).toISOString(),
  expiresAt: new Date(Date.now() + 7200000).toISOString(),
  note: "Cùng đi nhé",
  version: 0,
  termsVersion: 0,
  remainingSeats: 1,
};
type Recorded = {
  path: string;
  body: Record<string, unknown>;
  key: string | undefined;
};
async function setup(
  page: Page,
  options: { matches?: boolean; failPostOnce?: boolean } = {},
) {
  const writes: Recorded[] = [];
  let discovery: Record<string, unknown> | undefined;
  let failed = false;
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname;
    const body =
      req.method() === "POST"
        ? (req.postDataJSON() as Record<string, unknown>)
        : {};
    const write = [
      "/trips",
      "/ride-post-sources",
      "/ride-posts",
      "/trips/trip/open",
      "/ride-posts/published/publish",
      "/ride-posts/candidate/responses",
    ].includes(path.slice(7));
    if (write && req.method() === "POST")
      writes.push({
        path: path.slice(7),
        body,
        key: req.headers()["idempotency-key"],
      });
    let json: unknown = [];
    if (path.endsWith("/auth/session"))
      json = {
        authenticated: true,
        user: { id: "viewer", displayName: "Hồ Khánh" },
        session: { id: "session" },
      };
    else if (path.endsWith("/realtime/tickets"))
      return route.fulfill({ status: 503, json: {} });
    else if (path.endsWith("/social/revision")) json = { revision: 1 };
    else if (path.endsWith("/ride-capabilities"))
      json = {
        canCreateTrip: true,
        posting: true,
        vehicles: [
          { id: "bike", type: "MOTORCYCLE", passengerCapacity: 1 },
          { id: "car", type: "CAR", passengerCapacity: 4 },
        ],
      };
    else if (path.endsWith("/place-sessions"))
      json = { sessionToken: "session" };
    else if (path.endsWith("/places/resolve"))
      json = body.placeRef === "start" ? start : end;
    else if (path.endsWith("/routing/places")) {
      const q = new URL(req.url()).searchParams.get("query");
      json = [
        {
          ...(q === "start" ? start : end),
          mainText: "Chọn địa điểm",
          secondaryText: "Hà Nội",
        },
      ];
    } else if (
      path.endsWith("/routing/routes") ||
      path.endsWith("/routing/routes/route")
    )
      json = savedRoute;
    else if (path.endsWith("/routing/estimates"))
      json = { amountVnd: 10000, suggestedPerKmVnd: 1000 };
    else if (path.endsWith("/ride-discovery")) {
      discovery = body;
      json = {
        items: options.matches
          ? [
              {
                post: {
                  ...samplePost,
                  type: body.role === "driver" ? "NEED_RIDE" : "OFFER_RIDE",
                },
                pickupDistanceMeters: 2000,
                destinationDistanceMeters: 1000,
                timeDifferenceMinutes: 30,
              },
            ]
          : [],
      };
    } else if (path.endsWith("/ride-posts/candidate/pickup-checks"))
      json = {
        id: "sample-check",
        postId: "candidate",
        postVersion: 0,
        pickup: start,
        dropoff: end,
        destinationLabel: end.displayLabel,
        driverDestinationLabel: end.displayLabel,
        geometry: savedRoute.geometry,
        pickupIndex: 0,
        dropoffIndex: savedRoute.geometry.length - 1,
        extraMeters: 0,
        extraSeconds: 0,
        compatible: true,
        provider: "GOONG",
        pickupAt: new Date(Date.now() + 60000).toISOString(),
        expiresAt: new Date(Date.now() + 300000).toISOString(),
      };
    else if (
      path.endsWith("/ride-posts/candidate/route") ||
      path.endsWith("/ride-posts/published/route")
    )
      json = savedRoute;
    else if (path.endsWith("/trips") || path.endsWith("/trips/trip/open"))
      json = { id: "trip", version: path.endsWith("/open") ? 1 : 0 };
    else if (path.endsWith("/ride-post-sources"))
      json = { id: "source", version: 0 };
    else if (path.endsWith("/ride-posts") && req.method() === "POST") {
      if (options.failPostOnce && !failed) {
        failed = true;
        return route.fulfill({
          status: 503,
          json: { error: { code: "TEMPORARY", message: "Thử lại" } },
        });
      }
      json = {
        ...samplePost,
        id: "published",
        ownerId: "viewer",
        status: "DRAFT",
        ...body,
      };
    } else if (path.endsWith("/ride-posts/published"))
      json = { ...samplePost, id: "published", ownerId: "viewer" };
    else if (path.endsWith("/ride-posts/published/publish"))
      json = { ...samplePost, id: "published" };
    else if (path.endsWith("/responses"))
      json = req.method() === "POST" ? { id: "response" } : [];
    return route.fulfill({ json });
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
  return { writes, discovery: () => discovery };
}
async function fill(page: Page, role = "driver") {
  await page.goto(`/rides/new?mode=${role}`);
  await expect(page.locator('input[type="datetime-local"]')).not.toHaveValue(
    "",
  );
  for (const [i, value] of [
    [0, "start"],
    [1, "end"],
  ] as const) {
    const picker = page.locator(".unified-place-picker").nth(i);
    await picker.locator("input").fill(value);
    await picker.locator(".unified-place-search-btn").click();
    await picker.getByRole("button", { name: /Chọn địa điểm/ }).click();
  }
  await page
    .getByRole("button", { name: "Tính tuyến đường", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Bắt đầu tìm chuyến", exact: true }),
  ).toBeEnabled();
  if (process.env.DIKE_CAPTURE_FLOW)
    await page.screenshot({
      path: `../../.tmp/unified-form-${page.viewportSize()?.width}.png`,
      fullPage: true,
    });
}
async function find(page: Page) {
  await page
    .getByRole("button", { name: "Bắt đầu tìm chuyến", exact: true })
    .click();
  await expect(page.getByLabel("Chế độ bài đăng")).toBeVisible();
}

for (const role of ["driver", "passenger"] as const) {
  test(`assistant hands ${role} draft to existing form and publishes only after review`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    const state = await setup(page);
    let confirmations = 0;
    let routeCalls = 0;
    await page.route("**/api/v1/routing/routes", (route) => {
      routeCalls++;
      return route.fulfill({
        json: {
          ...savedRoute,
          expiresAt:
            role === "passenger" && routeCalls === 1
              ? new Date(Date.now() - 1000).toISOString()
              : new Date(Date.now() + 86400000).toISOString(),
        },
      });
    });
    const tomorrow = new Date(Date.now() + 86400000);
    const date = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
    await page.route("**/assistant/conversations", (route) =>
      route.fulfill({ json: { id: "chat" } }),
    );
    await page.route("**/assistant/conversations/*/confirm", (route) => {
      confirmations++;
      return route.fulfill({ json: {} });
    });
    await page.route("**/assistant/conversations/*/messages", (route) =>
      route.fulfill({
        json: {
          text: "Mình cần thêm: hạn đến nơi.",
          draft: {
            id: "draft",
            kind: "INTENT",
            version: 1,
            fields: {
              originQuery: "start",
              destinationQuery: "end",
              date,
              departureTime: "07:00",
              role: role === "driver" ? "DRIVER" : "RIDER",
              seats: "1",
            },
          },
          source: null,
          bookings: [],
          checkedAt: null,
        },
      }),
    );
    await page.goto(
      role === "passenger" ? "/rides/new?mode=passenger" : "/schedules",
    );
    await page
      .getByRole("button", { name: "Mở trợ lý Dike", exact: true })
      .click();
    await page
      .getByLabel("Tin nhắn của bạn")
      .fill("Mai 7 giờ sáng đi từ A tới B");
    await page
      .getByRole("button", { name: "Gửi tin nhắn", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Bản nháp chuyến đi" }),
    ).toBeVisible();
    await expect(page.getByLabel("Hạn đến nơi", { exact: true })).toHaveCount(
      0,
    );
    for (let i = 0; i < 2; i++) {
      await page
        .getByRole("button", { name: "Tìm địa chỉ chính xác", exact: true })
        .nth(i)
        .click();
      await page
        .getByRole("button", {
          name: i === 0 ? start.displayLabel : end.displayLabel,
          exact: true,
        })
        .click();
    }
    await page
      .getByRole("button", {
        name: "Tìm bài phù hợp và đăng bài",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/rides/new\\?mode=${role}&assistantDraft=`),
      { timeout: 20000 },
    );
    await expect(
      page.getByRole("dialog", { name: "Trợ lý Dike" }),
    ).toBeHidden();
    await expect(page.getByLabel("Chế độ bài đăng")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Tính tuyến đường", exact: true }),
    ).toHaveCount(0);
    expect(state.discovery()).toMatchObject({
      role,
      routeId: "route",
      seats: 1,
    });
    expect(routeCalls).toBe(role === "passenger" ? 2 : 1);
    await page.reload();
    await expect(page.getByLabel("Chế độ bài đăng")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Tính tuyến đường", exact: true }),
    ).toHaveCount(0);
    expect(confirmations).toBe(0);
    expect(state.writes).toHaveLength(0);
    await page.getByRole("button", { name: "Quay lại chỉnh sửa" }).click();
    await expect(
      page.getByRole("textbox", { name: "Điểm đi", exact: true }),
    ).toHaveValue(start.displayLabel);
    await expect(page.locator('input[type="datetime-local"]')).toHaveValue(
      `${date}T07:00`,
    );
    await find(page);
    expect(state.writes).toHaveLength(0);
    await page.getByRole("button", { name: "Đăng bài", exact: true }).click();
    await expect(page).toHaveURL(/\/feed\/published/, { timeout: 60000 });
    expect(state.writes.map((w) => w.path)).toEqual(
      role === "driver"
        ? ["/trips", "/ride-posts", "/trips/trip/open"]
        : [
            "/ride-post-sources",
            "/ride-posts",
            "/ride-posts/published/publish",
          ],
    );
  });
}

test("one page keeps the draft private until publish, fixes motorbike seats and preserves edited fields", async ({
  page,
}) => {
  const state = await setup(page);
  await fill(page);
  await expect(page.getByRole("button", { name: "Tăng số chỗ" })).toHaveCount(
    0,
  );
  await expect(
    page.locator(".unified-right-panel .ride-inline-stats"),
  ).toContainText("4,2 km");
  expect(state.writes).toHaveLength(0);
  await find(page);
  expect(state.writes).toHaveLength(0);
  expect(state.discovery()).toMatchObject({
    routeId: "route",
    role: "driver",
    seats: 1,
  });
  await expect(
    page.getByText("Chưa tìm thấy chuyến phù hợp", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Quay lại chỉnh sửa" }).click();
  await expect(
    page.getByRole("textbox", { name: "Điểm đi", exact: true }),
  ).toHaveValue(start.displayLabel);
  await page.getByRole("button", { name: "Ô tô", exact: true }).click();
  await page.getByRole("button", { name: "Tăng số chỗ" }).click();
  await expect(page.getByLabel("Số chỗ", { exact: true })).toHaveText("2");
  await expect(
    page.getByRole("button", { name: "Tính tuyến đường", exact: true }),
  ).toBeVisible();
});
for (const role of ["driver", "passenger"])
  for (const audience of ["PUBLIC", "FRIENDS", "DRAFT"]) {
    test(`${role} publishes using ${audience} from the same preview`, async ({
      page,
    }) => {
      const state = await setup(page);
      await fill(page, role);
      await find(page);
      if (process.env.DIKE_CAPTURE_FLOW)
        await page.screenshot({
          path: `../../.tmp/unified-matches-${role}-${page.viewportSize()?.width}.png`,
          fullPage: true,
        });
      expect(state.writes).toHaveLength(0);
      await page.getByLabel("Chế độ bài đăng").selectOption(audience);
      await page.getByRole("button", { name: "Đăng bài", exact: true }).click();
      await expect(page).toHaveURL(/\/feed\/published/);
      const paths = state.writes.map((w) => w.path);
      expect(paths).toEqual(
        role === "driver"
          ? [
              "/trips",
              "/ride-posts",
              ...(audience === "DRAFT" ? [] : ["/trips/trip/open"]),
            ]
          : [
              "/ride-post-sources",
              "/ride-posts",
              ...(audience === "DRAFT"
                ? []
                : ["/ride-posts/published/publish"]),
            ],
      );
      expect(
        state.writes.find((w) => w.path === "/ride-posts")?.body.visibility,
      ).toBe(audience === "DRAFT" ? "PUBLIC" : audience);
      const source = state.writes[0].body;
      expect(new Date(source.departureAt as string).getTime()).toBeGreaterThan(
        Date.now() - 5000,
      );
      if (role === "driver")
        expect(source).toMatchObject({
          vehicleId: "bike",
          offeredSeats: 1,
          detourMeters: 1000,
        });
    });
  }
test("retrying after post creation fails does not create another trip", async ({
  page,
}) => {
  const state = await setup(page, { failPostOnce: true });
  await fill(page);
  await find(page);
  await page.getByRole("button", { name: "Đăng bài", exact: true }).click();
  await expect(page.getByText("Thử lại", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Đăng bài", exact: true }).click();
  await expect(page).toHaveURL(/\/feed\/published/);
  expect(state.writes.filter((w) => w.path === "/trips")).toHaveLength(1);
  const attempts = state.writes.filter((w) => w.path === "/ride-posts");
  expect(attempts).toHaveLength(2);
  expect(attempts[0].key).toBe(attempts[1].key);
});
for (const role of ["driver", "passenger"])
  test(`${role} opens the existing request form without publishing the draft`, async ({
    page,
  }) => {
    const state = await setup(page, { matches: true });
    await fill(page, role);
    await find(page);
    await page
      .getByRole("button", {
        name: role === "driver" ? "Đề nghị chở" : "Yêu cầu đi ké",
        exact: true,
      })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(state.writes).toHaveLength(0);
    if (role === "driver") {
      await page
        .getByRole("button", { name: "Gửi yêu cầu", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(state.writes.map((w) => w.path)).toEqual([
        "/ride-posts/candidate/responses",
      ]);
    }
  });

for (const [entry, role] of [
  ["/trips/new", "driver"],
  ["/feed/new", "passenger"],
])
  test(`${entry} retains the existing route in the unified form`, async ({
    page,
  }) => {
    const state = await setup(page);
    let directions = 0;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().endsWith("/routing/routes"))
        directions++;
    });
    await page.goto(`${entry}?route=route`);
    await expect(page).toHaveURL(
      new RegExp(`/rides/new\\?mode=${role}&route=route`),
    );
    await expect(
      page.getByRole("button", { name: "Bắt đầu tìm chuyến", exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByRole("textbox", { name: "Điểm đi", exact: true }),
    ).toHaveValue(start.displayLabel);
    expect(state.writes).toHaveLength(0);
    expect(directions).toBe(0);
  });

test("request form prefills the chosen pickup and different destination without searching or sending", async ({
  page,
}) => {
  const state = await setup(page, { matches: true });
  const driverEnd = {
    ...end,
    latitude: 21.03,
    displayLabel: "Driver destination",
  };
  let checked = 0;
  await page.route("**/api/v1/ride-posts/candidate/route", (route) =>
    route.fulfill({
      json: {
        ...savedRoute,
        geometry: [{ ...start, latitude: 20.97 }, driverEnd],
      },
    }),
  );
  await page.route("**/api/v1/ride-posts/candidate/pickup-checks", (route) => {
    expect(route.request().postDataJSON()).toEqual({
      passengerRouteId: "route",
      ...(checked >= 1 ? { useDriverDropoff: true } : {}),
      ...(checked >= 2 ? { useDriverPickup: true } : {}),
    });
    checked++;
    return route.fulfill({
      json: {
        id: "prefilled-check",
        postId: "candidate",
        postVersion: 0,
        passengerId: "viewer",
        tripId: "driver-trip",
        tripVersion: 0,
        tripRouteVersion: 0,
        pickup: start,
        dropoff: checked === 1 ? end : driverEnd,
        destinationLabel: end.displayLabel,
        driverDestinationLabel: driverEnd.displayLabel,
        pickupAt: new Date(Date.now() + 600000).toISOString(),
        arrivalAt: new Date(Date.now() + 1200000).toISOString(),
        geometry: [{ ...start, latitude: 20.97 }, start, end, driverEnd],
        pickupIndex: 1,
        dropoffIndex: 2,
        extraMeters: 500,
        extraSeconds: 180,
        maxExtraMeters: 1000,
        maxExtraSeconds: 300,
        compatible: true,
        reason: "COMPATIBLE",
        provider: "GOONG",
        expiresAt: new Date(Date.now() + 300000).toISOString(),
      },
    });
  });
  await fill(page, "passenger");
  await page.locator(".unified-left-panel textarea").fill("Message from draft");
  await find(page);
  await page
    .getByRole("button", { name: "Yêu cầu đi ké", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByLabel("Điểm đón của bạn", { exact: true }),
  ).toHaveValue(start.displayLabel);
  await expect(
    dialog.getByLabel("Điểm đến của bạn", { exact: true }),
  ).toHaveValue(end.displayLabel);
  await expect(dialog.locator("#pickup-message")).toHaveValue(
    "Message from draft",
  );
  await expect.poll(() => checked).toBe(1);
  await expect(
    dialog.getByRole("button", { name: "Gửi yêu cầu đi ké", exact: true }),
  ).toBeEnabled();
  await expect(dialog.locator(".maplibregl-marker")).toHaveCount(4);
  await expect(dialog.locator(".route-member-marker--origin")).toHaveCount(2);
  await expect(dialog.locator(".route-member-marker--destination")).toHaveCount(
    2,
  );
  await expect(dialog.locator(".route-member-marker-avatar")).toHaveCount(4);
  for (const marker of await dialog
    .locator(".route-member-marker--origin > svg")
    .all()) {
    await expect(marker).toHaveCSS("fill", "rgb(233, 189, 82)");
  }
  for (const marker of await dialog
    .locator(".route-member-marker--destination > svg")
    .all()) {
    await expect(marker).toHaveCSS("fill", "rgb(7, 150, 110)");
  }
  const submit = dialog.getByRole("button", {
    name: "Gửi yêu cầu đi ké",
    exact: true,
  });
  await expect(submit).toBeInViewport({ ratio: 1 });
  const beforeScroll = await submit.boundingBox();
  await dialog.locator(".passenger-scroll").evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(submit).toBeInViewport({ ratio: 1 });
  expect((await submit.boundingBox())!.y).toBeCloseTo(beforeScroll!.y, 0);
  await dialog.locator(".passenger-scroll").evaluate((element) => {
    element.scrollTop = 0;
  });
  if (process.env.DIKE_PREVIEW_REQUEST)
    await dialog.screenshot({
      path: `../../.tmp/request-footer-${test.info().project.name}.png`,
    });
  expect(checked).toBe(1);
  await dialog
    .getByRole("button", { name: "Đổi điểm đến", exact: true })
    .click();
  await expect.poll(() => checked).toBe(2);
  await expect(dialog.locator(".maplibregl-marker")).toHaveCount(3);
  await expect(dialog.locator(".route-member-marker--origin")).toHaveCount(2);
  await expect(dialog.locator(".route-member-marker--destination")).toHaveCount(
    1,
  );
  await expect(
    dialog.locator(".route-member-marker--shared .route-member-marker-avatar"),
  ).toHaveCount(2);
  await expect(
    dialog.getByLabel("Điểm đến của bạn", { exact: true }),
  ).toHaveValue("");
  await dialog
    .getByRole("button", { name: "Đổi điểm đón", exact: true })
    .click();
  expect(checked).toBe(2);
  await expect(dialog.locator(".maplibregl-marker")).toHaveCount(2);
  await expect(
    dialog.getByLabel("Điểm đón của bạn", { exact: true }),
  ).toHaveValue("");
  await expect(
    dialog.getByRole("button", { name: "Gửi yêu cầu đi ké", exact: true }),
  ).toBeEnabled();
  expect(state.writes).toHaveLength(0);
  await dialog
    .getByRole("button", { name: "Gửi yêu cầu đi ké", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(state.writes.map((w) => w.path)).toEqual([
    "/ride-posts/candidate/responses",
  ]);
  expect(state.writes[0].body).toEqual({
    message: "Message from draft",
  });
});
