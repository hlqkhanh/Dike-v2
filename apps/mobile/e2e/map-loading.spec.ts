import { test, expect, type Page } from "@playwright/test";
import { setup, post } from "./fixtures";

// Emulate a slow basemap: render is available, but tiles fail and idle never fires.
const mapModule = `
export function setWorkerUrl() {}
export function setWorkerCount() {}
export class LngLatBounds { extend() { return this; } }
export class NavigationControl {}
export class Marker { constructor(options){this.options=options;} setLngLat(point) { this.point=point;return this; } setOffset(offset) { this.offset=offset;return this; } addTo() { if(this.options.element){this.options.element.dataset.coordinate=JSON.stringify(this.point);this.options.element.dataset.anchor=this.options.anchor;this.options.element.dataset.offset=JSON.stringify(this.options.offset);} (window.markerColors ||= []).push(this.options.color ?? this.options.element?.style.getPropertyValue("--pin-color")); if(this.options.element)document.getElementById("map").appendChild(this.options.element);return this; } }
export class Map {
  constructor(options) {
    window.mapOptions=options;this.sources={};this.layers={};
    this.events = {}; this.styleReady = false;
    window.mapInstance = Math.random(); window.testMap=this;
    setTimeout(() => {
      this.emit('error', {sourceId:'basemap', error:new Error('tile unavailable')});
      this.styleReady = true; this.emit('style.load');
    }, 20);
  }
  emit(type, data = {}) { for (const callback of [...(this.events[type] || [])]) callback(data); }
  on(type, callback) { (this.events[type] ||= []).push(callback); return this; }
  once(type, callback) { const once = data => { this.events[type] = this.events[type].filter(c => c !== once); callback(data); }; return this.on(type, once); }
  isStyleLoaded() { return this.styleReady; }
  resize() {} fitBounds() {}
  addSource(id, source) { this.sources[id]=source; }
  addLayer(layer) { this.layers[layer.id]=layer; }
  setLayoutProperty(id, key, value) { (this.layers[id].layout ||= {})[key]=value; }
  addControl() { if(!document.querySelector('.maplibregl-ctrl-top-right')){const el=document.createElement('div');el.className='maplibregl-ctrl-top-right';document.getElementById('map').appendChild(el);} }

  project() { return {x:100}; } getContainer() { return document.getElementById("map"); }
  triggerRepaint() { setTimeout(() => this.emit('render'), 10); }
}
`;

async function maps(page: Page, count = 1, failFirst = false) {
  await setup(page);
  const requested: string[] = [];
  let libraryRequests = 0;
  await page.route("**/api/v1/ride-posts?**", (route) =>
    route.fulfill({
      json: {
        items: Array.from({ length: count }, (_, index) => ({
          ...post,
          id: "map-" + index,
        })),
      },
    }),
  );
  await page.route("**/api/v1/ride-posts/*/route", (route) => {
    requested.push(new URL(route.request().url()).pathname);
    return route.fulfill({
      json: {
        geometry: [
          { latitude: 13.8068, longitude: 109.2191 },
          { latitude: 13.758, longitude: 109.2195 },
        ],
      },
    });
  });
  await page.route("https://unpkg.com/maplibre-gl@6.14.0/dist/**", (route) => {
    const url = route.request().url();
    if (url.endsWith("maplibre-gl.mjs")) {
      libraryRequests++;
      if (failFirst && libraryRequests === 1) return route.abort();
      return route.fulfill({ contentType: "text/javascript", body: mapModule });
    }
    return route.fulfill({
      contentType: url.endsWith(".css") ? "text/css" : "text/javascript",
      body: "",
    });
  });
  return { requested };
}

test("feed avatar and name open the author profile without opening the post", async ({
  page,
}) => {
  await maps(page);
  await page.goto("/");
  const card = page.getByTestId("ride-post-card").first();
  await card
    .getByRole("link", {
      name: "Xem trang cá nhân " + post.ownerDisplayName,
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(new RegExp("/user/" + post.ownerId + "$"));
  await page.goBack();
  await card.getByText(post.ownerDisplayName, { exact: true }).click();
  await expect(page).toHaveURL(new RegExp("/user/" + post.ownerId + "$"));
});

test("conversation avatar and name open the companion profile", async ({
  page,
}) => {
  await setup(page);
  for (const path of ["/inbox", "/chat/conversation-1"]) {
    await page.goto(path);
    await page
      .getByRole("link", { name: "Xem trang cá nhân Thu Hà", exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/user\/other$/);
    await page.goto(path);
    await page
      .getByRole("link", { name: "Thu Hà", exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/user\/other$/);
  }
});

test("feed mounts nearby maps and releases maps far offscreen", async ({
  page,
}) => {
  const { requested } = await maps(page, 12);
  await page.goto("/");
  await expect.poll(() => requested.length).toBeGreaterThan(0);
  expect(requested.length).toBeLessThan(12);
  expect(requested.some((path) => path.includes("map-11/"))).toBe(false);
  const last = page.getByTestId("ride-post-card").last();
  await last.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await expect
    .poll(() => requested.some((path) => path.includes("map-11/")))
    .toBe(true);
  await expect(last.frameLocator("iframe").locator("body")).toHaveAttribute(
    "data-state",
    "ready",
  );
  await expect(
    page.getByTestId("ride-post-card").first().locator("iframe"),
  ).toHaveCount(0);
  expect(await page.locator("iframe").count()).toBeLessThan(7);
});

test("tile errors and an absent idle event do not block a rendered route", async ({
  page,
}) => {
  await maps(page);
  await page.goto("/");
  const card = page.getByTestId("ride-post-card").first();
  const body = card.frameLocator("iframe").locator("body");
  await expect(body).toHaveAttribute("data-state", "ready");
  const instance = await body.evaluate(
    () => (window as unknown as { mapInstance: number }).mapInstance,
  );
  await card.getByRole("button", { name: /^M/ }).click();
  await expect(body).toHaveAttribute("data-state", "ready");
  expect(
    await body.evaluate(
      () => (window as unknown as { mapInstance: number }).mapInstance,
    ),
  ).toBe(instance);
});

test("a failed library load can be retried successfully", async ({ page }) => {
  await maps(page, 1, true);
  await page.goto("/");
  const card = page.getByTestId("ride-post-card").first();
  const retry = card.getByRole("button", { name: /^Th/ });
  await expect(retry).toBeVisible();
  await retry.click();
  await expect(card.frameLocator("iframe").locator("body")).toHaveAttribute(
    "data-state",
    "ready",
  );
});

test("opening details from a feed map renders the route without a component error", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await maps(page);
  await page.route("**/api/v1/ride-posts/map-0", (route) =>
    route.fulfill({ json: { ...post, id: "map-0" } }),
  );
  await page.route("**/api/v1/ride-posts/map-0/responses", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.goto("/");
  const card = page.getByTestId("ride-post-card").first();
  await expect(card.frameLocator("iframe").locator("body")).toHaveAttribute(
    "data-state",
    "ready",
  );
  await card.getByRole("button", { name: /^Xem chi/ }).click();
  await expect(page).toHaveURL(/posts\/map-0$/);
  const detailMap = page.locator("iframe").last();
  await expect(detailMap).toBeVisible();
  await expect(detailMap.contentFrame().locator("body")).toHaveAttribute(
    "data-state",
    "ready",
  );
  const instance = await detailMap
    .contentFrame()
    .locator("body")
    .evaluate(() => (window as unknown as { mapInstance: number }).mapInstance);
  const headerBefore = await page
    .getByTestId("post-floating-header")
    .boundingBox();
  const sheetBefore = await page.getByTestId("post-detail-sheet").boundingBox();
  await page
    .getByRole("button", { name: "Thay đổi độ mở bảng chọn", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await page.getByTestId("post-detail-sheet").boundingBox()).height,
    )
    .toBeGreaterThanOrEqual(sheetBefore.height - 1);
  expect(await page.getByTestId("post-floating-header").boundingBox()).toEqual(
    headerBefore,
  );
  expect(
    await detailMap
      .contentFrame()
      .locator("body")
      .evaluate(() => window.mapInstance),
  ).toBe(instance);
  expect(errors).toEqual([]);
});

for (const count of [3, 4]) {
  test(
    "selecting a request shows " +
      count +
      " stops and shared decision controls",
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await maps(page);
      const geometry = [
        { latitude: 13.8068, longitude: 109.2191 },
        { latitude: 13.79, longitude: 109.218 },
        { latitude: 13.77, longitude: 109.22 },
        { latitude: 13.758, longitude: 109.2195 },
      ];
      await page.route("**/api/v1/ride-posts/post-1", (route) =>
        route.fulfill({ json: { ...post, ownerId: "member" } }),
      );
      await page.route("**/api/v1/ride-posts/post-1/responses", (route) =>
        route.fulfill({
          json: [
            {
              id: "selected",
              postId: "post-1",
              requesterId: "rider",
              requesterDisplayName: "Test rider",
              status: "PENDING",
              version: 7,
              createdAt: post.departureAt,
              pickupCheck: {
                geometry,
                pickupIndex: 1,
                dropoffIndex: count === 4 ? 2 : 3,
                pickup: { ...geometry[1], displayLabel: "Custom pickup" },
                dropoff: {
                  ...geometry[count === 4 ? 2 : 3],
                  displayLabel: "Custom dropoff",
                },
                pickupAt: post.departureAt,
              },
              requestSummary: {
                pickupChanged: true,
                dropoffChanged: count === 4,
                extraMeters: 500,
                extraSeconds: 120,
                estimatedAmountVnd: 12000,
              },
            },
          ],
        }),
      );
      await page.goto("/posts/post-1");
      const body = page
        .getByTestId("post-detail-map")
        .frameLocator("iframe")
        .locator("body");
      await expect(body).toHaveAttribute("data-state", "ready");
      await expect(body).toHaveAttribute("data-marker-count", "2");
      const src = await page
        .getByTestId("post-detail-map")
        .locator("iframe")
        .getAttribute("srcdoc");
      expect(src).toContain("styles/positron");
      const toggle = page.getByTestId("post-summary-toggle");
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(page.getByTestId("post-journey-summary")).not.toContainText(
        post.originLabel,
      );
      await expect(page.getByTestId("post-journey-summary")).toContainText(
        "Ô tô",
      );
      await expect(body).toHaveAttribute("data-viewport-top", /^[0-9.]+$/);
      const collapsedHeight = (
        await page.getByTestId("post-floating-header").boundingBox()
      ).height;
      const instance = await body.evaluate(
        () => (window as unknown as { mapInstance: number }).mapInstance,
      );
      const compactInset = Number(await body.getAttribute("data-viewport-top"));
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByTestId("post-journey-summary")).toContainText(
        post.originLabel,
      );
      await expect
        .poll(async () => Number(await body.getAttribute("data-viewport-top")))
        .toBeGreaterThan(compactInset + 30);
      expect(
        await body.evaluate(
          () => (window as unknown as { mapInstance: number }).mapInstance,
        ),
      ).toBe(instance);
      expect(
        await page
          .getByTestId("post-detail-map")
          .locator("iframe")
          .getAttribute("srcdoc"),
      ).toBe(src);
      await expect(body).toHaveAttribute("data-state", "ready");
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect
        .poll(
          async () =>
            (await page.getByTestId("post-floating-header").boundingBox())
              .height,
        )
        .toBeLessThan(collapsedHeight + 2);
      expect(
        await body.evaluate(
          () => (window as unknown as { mapInstance: number }).mapInstance,
        ),
      ).toBe(instance);
      await page
        .getByRole("button", { name: "Thay đổi độ mở bảng chọn", exact: true })
        .click();
      await expect(page.getByTestId("request-decision-bar")).toHaveCount(0);
      await page.getByTestId("select-request-selected").click();
      await expect(body).toHaveAttribute("data-state", "ready");
      await expect(body).toHaveAttribute("data-marker-count", String(count));
      const bar = page.getByTestId("request-decision-bar");
      await expect(bar.getByRole("button")).toHaveCount(2);
      await expect(
        page
          .getByTestId("request-comment-selected")
          .getByRole("button", { name: "Chấp nhận", exact: true }),
      ).toHaveCount(0);
      // Tapping the selected card again clears selection and restores the base route.
      await page
        .getByTestId("select-request-selected")
        .click({ position: { x: 30, y: 35 } });
      await expect(bar).toHaveCount(0);
      await expect(body).toHaveAttribute("data-marker-count", "2");
      await page
        .getByTestId("select-request-selected")
        .click({ position: { x: 30, y: 35 } });
      await expect(bar).toBeVisible();
      // A real map click, forwarded through the frame bridge, also clears selection.
      await body.evaluate(() =>
        (
          window as unknown as { testMap: { emit: (type: string) => void } }
        ).testMap.emit("click"),
      );
      await expect(bar).toHaveCount(0);
      await expect(body).toHaveAttribute("data-marker-count", "2");
      await page
        .getByTestId("select-request-selected")
        .click({ position: { x: 30, y: 35 } });
      await expect(bar).toBeVisible();
      await page
        .getByTestId("requests-background")
        .click({ position: { x: 4, y: 4 } });
      await expect(bar).toHaveCount(0);
      await expect(body).toHaveAttribute("data-marker-count", "2");
      await page
        .getByTestId("select-request-selected")
        .click({ position: { x: 30, y: 35 } });
      await expect(bar).toBeVisible();
      await page
        .getByTestId("post-journey-summary")
        .click({ position: { x: 10, y: 10 } });
      await expect(bar).toHaveCount(0);
      await page
        .getByTestId("select-request-selected")
        .click({ position: { x: 30, y: 35 } });
      await expect(bar).toBeVisible();
      await bar.getByRole("button", { name: "Chấp nhận", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Xác nhận", exact: true }),
      ).toBeVisible();
      expect(errors).toEqual([]);
    },
  );
}

for (const type of ["OFFER_RIDE", "NEED_RIDE"]) {
  test(
    "typing preserves the map and resolved places update " + type + " markers",
    async ({ page }) => {
      await maps(page);
      const base = [
        { latitude: 13.8068, longitude: 109.2191 },
        { latitude: 13.758, longitude: 109.2195 },
      ];
      const pickup = {
        latitude: 13.79,
        longitude: 109.218,
        displayLabel: "Custom pickup",
      };
      const dropoff = {
        latitude: 13.77,
        longitude: 109.22,
        displayLabel: "Custom dropoff",
      };
      const previews: unknown[] = [];
      await page.route("**/api/v1/ride-posts/post-1", (route) =>
        route.fulfill({ json: { ...post, type } }),
      );
      await page.route("**/api/v1/routing/places/resolve", (route) => {
        const ref = route.request().postDataJSON().placeRef;
        return route.fulfill({
          json: {
            ...(ref === "origin-ref" ? pickup : dropoff),
            placeRef: ref,
            resolvedAt: new Date().toISOString(),
          },
        });
      });
      await page.route("**/api/v1/ride-posts/post-1/pickup-checks", (route) => {
        const body = route.request().postDataJSON();
        previews.push(body);
        const end = body.useDriverDropoff ? base[1] : dropoff;
        return route.fulfill({
          json: {
            id: "preview",
            compatible: true,
            pickup,
            dropoff: end,
            pickupIndex: 1,
            dropoffIndex: body.useDriverDropoff ? 2 : 2,
            geometry: body.useDriverDropoff
              ? [base[0], pickup, base[1]]
              : [base[0], pickup, dropoff, base[1]],
            expiresAt: new Date(Date.now() + 60000).toISOString(),
          },
        });
      });
      await page.route("**/api/v1/routing/routes", (route) => {
        previews.push(route.request().postDataJSON());
        return route.fulfill({ json: { geometry: [pickup, dropoff] } });
      });
      await page.goto("/posts/post-1");
      const frame = page.getByTestId("post-detail-map").frameLocator("iframe");
      const body = frame.locator("body");
      await expect(body).toHaveAttribute("data-state", "ready");
      const instance = await body.evaluate(
        () => (window as unknown as { mapInstance: number }).mapInstance,
      );
      const originalMapHeight = (
        await page.getByTestId("post-detail-map").boundingBox()
      ).height;
      // Simulate the window height shrinking while the keyboard is visible.
      await page.setViewportSize({ width: 390, height: 540 });
      await expect
        .poll(
          async () =>
            (await page.getByTestId("post-detail-map").boundingBox()).height,
        )
        .toBe(originalMapHeight);
      expect(
        await body.evaluate(
          () => (window as unknown as { mapInstance: number }).mapInstance,
        ),
      ).toBe(instance);
      await page.setViewportSize({ width: 390, height: 844 });
      const input = page
        .getByTestId("post-request-composer")
        .getByLabel("Điểm đi", { exact: true });
      await input.fill("FPT pickup");
      await expect(
        page.getByRole("button", { name: /FPT pickup/ }),
      ).toBeVisible();
      const sheet = page.getByTestId("post-detail-sheet");
      await expect(sheet).toHaveAttribute("aria-expanded", "true");
      const focusedTop = (await sheet.boundingBox()).y;
      await page.setViewportSize({ width: 390, height: 540 });
      await expect(sheet).toHaveAttribute("aria-expanded", "true");
      await expect
        .poll(async () => {
          const bounds = await sheet.boundingBox();
          return Math.abs(bounds.y + bounds.height - 540);
        })
        .toBeLessThan(2);
      await page.setViewportSize({ width: 390, height: 844 });
      await expect
        .poll(async () => Math.abs((await sheet.boundingBox()).y - focusedTop))
        .toBeLessThan(2);
      expect(previews).toHaveLength(0);
      expect(
        await body.evaluate(
          () => (window as unknown as { mapInstance: number }).mapInstance,
        ),
      ).toBe(instance);
      await page.getByRole("button", { name: /FPT pickup/ }).click();
      await expect(body).toHaveAttribute("data-marker-count", "3");
      await expect(body).toHaveAttribute("data-state", "ready");
      const selectedInstance = await body.evaluate(
        () => (window as unknown as { mapInstance: number }).mapInstance,
      );
      const count = previews.length;
      const destination = page
        .getByTestId("post-request-composer")
        .getByLabel("Điểm đến", { exact: true });
      await destination.fill("Central destination");
      await expect(
        page.getByRole("button", { name: /Central destination/ }),
      ).toBeVisible();
      expect(previews).toHaveLength(count);
      expect(
        await body.evaluate(
          () => (window as unknown as { mapInstance: number }).mapInstance,
        ),
      ).toBe(selectedInstance);
      await page.getByRole("button", { name: /Central destination/ }).click();
      await expect.poll(() => previews.length).toBeGreaterThan(count);
      await expect(body).toHaveAttribute("data-state", "ready");
      await expect(body).toHaveAttribute("data-marker-count", "4");
      const originPins = frame.locator('.dike-member-pin[data-kind="origin"]');
      const destinationPins = frame.locator(
        '.dike-member-pin[data-kind="destination"]',
      );
      await expect(originPins.first()).toHaveAttribute("data-anchor", "bottom");
      await expect(originPins.first()).toHaveAttribute("data-offset", "[0,0]");
      await expect(originPins.first()).toHaveCSS("position", "absolute");
      await expect(originPins.first()).toHaveAttribute(
        "data-coordinate",
        JSON.stringify([base[0].longitude, base[0].latitude]),
      );
      await expect(destinationPins.first()).toHaveAttribute(
        "data-coordinate",
        JSON.stringify([base[1].longitude, base[1].latitude]),
      );
      await expect(originPins.last()).toHaveAttribute(
        "data-coordinate",
        JSON.stringify([pickup.longitude, pickup.latitude]),
      );
      await expect(destinationPins.last()).toHaveAttribute(
        "data-coordinate",
        JSON.stringify([dropoff.longitude, dropoff.latitude]),
      );
      await expect(
        originPins.first().locator("svg.dike-pin-shape"),
      ).toHaveCount(1);
      const colors = await body.evaluate(
        () => (window as unknown as { markerColors: string[] }).markerColors,
      );
      await expect(
        frame.locator('.dike-member-pin[data-kind="origin"]'),
      ).toHaveCount(2);
      await expect(
        frame.locator('.dike-member-pin[data-kind="destination"]'),
      ).toHaveCount(2);
      await expect(
        frame.locator('.dike-marker-person[data-member="other"]'),
      ).toHaveCount(2);
      await expect(
        frame.locator('.dike-marker-person[data-member="member"]'),
      ).toHaveCount(2);
      expect(colors).toEqual(["#e9bd52", "#00866e", "#e9bd52", "#00866e"]);
    },
  );
}

for (const type of ["OFFER_RIDE", "NEED_RIDE"]) {
  for (const own of [true, false]) {
    test(
      "confirmed " +
        type +
        " uses a scrolling journey for " +
        (own ? "owner" : "requester"),
      async ({ page }) => {
        await maps(page);
        const trip = { ...post, type, ownerId: own ? "member" : "other" };
        const geometry = [
          { latitude: 13.8068, longitude: 109.2191 },
          { latitude: 13.79, longitude: 109.218 },
          { latitude: 13.77, longitude: 109.22 },
          { latitude: 13.758, longitude: 109.2195 },
        ];
        const response = {
          id: "confirmed",
          postId: "post-1",
          ownerId: trip.ownerId,
          requesterId: own ? "rider" : "member",
          requesterDisplayName: "Test companion",
          action: type === "OFFER_RIDE" ? "REQUEST_RIDE" : "OFFER_RIDE",
          status: "ACCEPTED",
          version: 1,
          createdAt: post.departureAt,
          conversationId: "chat-1",
          message:
            type === "NEED_RIDE"
              ? "Điểm đi: Companion pickup\nĐiểm đến: Companion destination\nMeet at the gate"
              : "Meet at the gate",
          pickupCheck:
            type === "OFFER_RIDE"
              ? {
                  geometry,
                  pickupIndex: 1,
                  dropoffIndex: 2,
                  pickupAt: post.departureAt,
                  extraMeters: 500,
                  extraSeconds: 120,
                  estimatedAmountVnd: 15000,
                  pickup: {
                    ...geometry[1],
                    displayLabel: "Companion pickup, 7 Main Street",
                  },
                  dropoff: {
                    ...geometry[2],
                    displayLabel: "Companion destination, 8 Main Street",
                  },
                }
              : null,
        };
        await page.route("**/api/v1/ride-posts/post-1", (route) =>
          route.fulfill({ json: trip }),
        );
        await page.route("**/api/v1/ride-posts/post-1/responses", (route) =>
          route.fulfill({
            json: own
              ? [
                  response,
                  {
                    ...response,
                    id: "pending-extra",
                    requesterId: "another-member",
                    status: "PENDING",
                  },
                ]
              : [response],
          }),
        );
        const decisions: string[] = [];
        await page.route(
          "**/api/v1/ride-post-responses/confirmed/decision",
          async (route) => {
            const body = route.request().postDataJSON();
            expect(body.version).toBe(response.version);
            decisions.push(body.decision);
            response.status = body.decision;
            response.version++;
            await route.fulfill({ json: response });
          },
        );
        await page.route(
          "**/api/v1/bookings/confirmed/payment-acknowledgement",
          (route) =>
            route.fulfill({ json: { amountVnd: 15000, locked: false } }),
        );
        await page.route("**/api/v1/bookings/confirmed/payment", (route) =>
          route.fulfill({ json: { amountVnd: 15000, bankVerified: false } }),
        );
        await page.goto("/posts/post-1");
        await expect(page.getByTestId("confirmed-post-detail")).toBeVisible();
        await expect(page.getByTestId("post-detail-stage")).toHaveCount(0);
        await expect(page.getByTestId("post-detail-sheet")).toHaveCount(0);
        const merged = page.getByTestId("merged-journey-stops");
        await expect(merged.getByTestId("merged-journey-stop")).toHaveCount(4);
        await expect(merged).toContainText("Companion pickup");
        await expect(merged).toContainText("Companion destination");
        const stopCards = merged.getByTestId("merged-journey-stop");
        await expect(
          stopCards.nth(0).getByTestId("journey-art-driver-origin"),
        ).toBeVisible();
        await expect(
          stopCards.nth(1).getByTestId("journey-art-passenger-origin"),
        ).toBeVisible();
        await expect(
          stopCards.nth(2).getByTestId("journey-art-passenger-destination"),
        ).toBeVisible();
        await expect(
          stopCards.nth(3).getByTestId("journey-art-driver-destination"),
        ).toBeVisible();
        await expect(merged.getByText("Sẵn sàng đồng hành")).toHaveCount(0);
        await expect(merged.getByText("Người chở khởi hành")).toHaveCount(0);
        for (const state of ["ACCEPTED", "DRIVER_STARTED", "PAYMENT"]) {
          await expect(
            merged.getByTestId("journey-state-" + state),
          ).toBeVisible();
        }
        await expect(
          merged.getByTestId("journey-state-DRIVER_ARRIVED"),
        ).toHaveCount(0);
        await expect(merged.getByTestId("journey-state-COMPLETED")).toHaveCount(
          0,
        );
        if (type === "OFFER_RIDE") {
          await expect(
            merged.getByText("7 Main Street", { exact: true }),
          ).toBeVisible();
          await expect(
            merged.getByText("8 Main Street", { exact: true }),
          ).toBeVisible();
          await expect(
            merged.getByRole("button", { name: /Xem địa chỉ|Ẩn địa chỉ/ }),
          ).toHaveCount(0);
        }
        const card = page.getByTestId("confirmed-post-detail");
        const progress = card.getByLabel("Tiến độ chuyến đi", { exact: true });
        await expect(progress).toBeVisible();
        await expect(progress.getByTestId("journey-trail")).toBeVisible();
        const rider = progress.getByTestId("journey-rider");
        await expect(rider).toHaveAttribute(
          "aria-label",
          "Vị trí hiện tại: Đã xác nhận",
        );
        const trailBox = await progress
          .getByTestId("journey-trail")
          .boundingBox();
        const initialRiderBox = await rider.boundingBox();
        const initialRiderY = initialRiderBox!.y - trailBox!.y;
        await expect(card.getByTestId("journey-summary-details")).toHaveCount(
          0,
        );
        await expect(
          card.getByText("Hành trình của bạn", { exact: true }),
        ).toHaveCount(0);
        const confirmedComment = card.getByTestId("request-comment-confirmed");
        await expect(
          confirmedComment.getByTestId("request-pickup"),
        ).toHaveCount(0);
        await expect(
          confirmedComment.getByTestId("request-dropoff"),
        ).toHaveCount(0);
        await expect(page.getByTestId("confirmed-route-map")).toHaveCount(0);
        await card
          .getByRole("button", { name: "Mở thông tin hành trình", exact: true })
          .click();
        await expect(card.getByTestId("journey-summary-details")).toBeVisible();
        await expect(page.getByTestId("confirmed-route-map")).toBeVisible();
        await expect(
          card.getByRole("button", { name: "Xem bản đồ thực tế", exact: true }),
        ).toHaveCount(0);
        await expect(
          confirmedComment.getByRole("button", {
            name: "Mở trò chuyện",
            exact: true,
          }),
        ).toHaveCount(0);
        const map = page
          .getByTestId("confirmed-route-map")
          .frameLocator("iframe");
        await expect(map.locator("body")).toHaveAttribute(
          "data-marker-count",
          type === "OFFER_RIDE" ? "4" : "2",
        );
        await expect(
          card.getByRole("button", { name: "Rút yêu cầu", exact: true }),
        ).toHaveCount(0);
        if (own && type === "OFFER_RIDE") {
          await page.screenshot({
            path: "test-results/confirmed-trip-top.png",
          });
          await card.scrollIntoViewIfNeeded();
          await page.screenshot({
            path: "test-results/confirmed-trip-progress.png",
          });
        }
        await card
          .getByRole("button", {
            name: "Thu gọn thông tin hành trình",
            exact: true,
          })
          .click();
        await expect(card.getByTestId("journey-summary-details")).toHaveCount(
          0,
        );
        if (own && type === "OFFER_RIDE") {
          await progress
            .getByTestId("journey-trail")
            .screenshot({ path: "test-results/journey-trail-cards.png" });
        }
        const driver = (type === "OFFER_RIDE") === own;
        const start = card.getByRole("button", {
          name: "Bắt đầu đi",
          exact: true,
        });
        if (driver) {
          await expect(start).toBeVisible();
          await start.click();
          await page
            .getByRole("button", { name: "Xác nhận", exact: true })
            .click();
          await expect(rider).toHaveAttribute(
            "aria-label",
            "Vị trí hiện tại: Đang đến đón",
          );
          await expect
            .poll(async () => {
              const currentRiderBox = await rider.boundingBox();
              const currentTrailBox = await progress
                .getByTestId("journey-trail")
                .boundingBox();
              return currentRiderBox!.y - currentTrailBox!.y;
            })
            .toBeGreaterThan(initialRiderY + 30);
          await expect(
            card.getByRole("button", { name: "Đã đến điểm đón", exact: true }),
          ).toBeVisible();
          await card
            .getByRole("button", { name: "Đã đến điểm đón", exact: true })
            .click();
          await page
            .getByRole("button", { name: "Xác nhận", exact: true })
            .click();
          await expect(rider).toHaveAttribute(
            "aria-label",
            "Vị trí hiện tại: " +
              (type === "OFFER_RIDE"
                ? "Companion pickup"
                : post.originLabel.split(",")[0]),
          );
          await card
            .getByRole("button", { name: "Hoàn thành chuyến", exact: true })
            .click();
          await page
            .getByRole("button", { name: "Xác nhận", exact: true })
            .click();
          await expect(rider).toHaveAttribute(
            "aria-label",
            "Vị trí hiện tại: " +
              (type === "OFFER_RIDE"
                ? "Companion destination"
                : post.destinationLabel.split(",")[0]),
          );
          await expect(
            card.getByText("Đang chờ người đi ké xác nhận thanh toán."),
          ).toBeVisible();
          expect(decisions).toEqual([
            "DRIVER_STARTED",
            "DRIVER_ARRIVED",
            "COMPLETED",
          ]);
        } else {
          await expect(start).toHaveCount(0);
          await expect(
            card.getByText(
              "Bạn sẽ nhận thông báo khi người chở cập nhật hành trình.",
            ),
          ).toHaveCount(0);
          expect(decisions).toEqual([]);
        }
        if (own) {
          await card
            .getByRole("button", {
              name: "Mở thông tin hành trình",
              exact: true,
            })
            .click();
          await page.getByTestId("select-request-pending-extra").click();
          await expect(page.getByTestId("request-decision-bar")).toBeVisible();
          await page
            .getByTestId("requests-background")
            .click({ position: { x: 3, y: 3 } });
          await expect(page.getByTestId("confirmed-post-detail")).toBeVisible();
        }
      },
    );
  }
}

for (const [pickupIndex, dropoffIndex, expectedCount] of [
  [0, 3, 2],
  [0, 2, 3],
  [1, 3, 3],
  [1, 2, 4],
]) {
  test(
    "merged confirmed route shows " +
      expectedCount +
      " fields for indices " +
      pickupIndex +
      "/" +
      dropoffIndex,
    async ({ page }) => {
      await maps(page);
      const geometry = [
        { latitude: 13.8068, longitude: 109.2191 },
        { latitude: 13.79, longitude: 109.218 },
        { latitude: 13.77, longitude: 109.22 },
        { latitude: 13.758, longitude: 109.2195 },
      ];
      const response = {
        id: "merged",
        postId: "post-1",
        ownerId: "other",
        requesterId: "member",
        requesterDisplayName: "Rider",
        action: "REQUEST_RIDE",
        status: "ACCEPTED",
        version: 1,
        createdAt: post.departureAt,
        message: "At the gate",
        conversationId: "chat-1",
        pickupCheck: {
          geometry,
          pickupIndex,
          dropoffIndex,
          pickupAt: post.departureAt,
          pickup: {
            ...geometry[pickupIndex],
            displayLabel:
              pickupIndex === 0
                ? "Different label for the same pickup"
                : "Rider pickup, 7 Main Street",
          },
          dropoff: {
            ...geometry[dropoffIndex],
            displayLabel:
              dropoffIndex === 3
                ? post.destinationLabel
                : "Rider destination, 8 Main Street",
          },
        },
      };
      await page.route("**/api/v1/ride-posts/post-1/responses", (route) =>
        route.fulfill({ json: [response] }),
      );
      await page.goto("/posts/post-1");
      const merged = page.getByTestId("merged-journey-stops");
      const fields = merged.getByTestId("merged-journey-stop");
      await expect(fields).toHaveCount(expectedCount);
      await expect
        .poll(async () => {
          const sources = await fields.evaluateAll((cards) =>
            cards
              .map((card) =>
                card
                  .querySelector('[data-testid^="journey-art-"] img')
                  ?.getAttribute("src"),
              )
              .filter(Boolean),
          );
          return new Set(sources).size;
        })
        .toBe(expectedCount);

      await expect(
        fields
          .first()
          .getByTestId(
            "journey-art-" +
              (pickupIndex === 0 ? "shared" : "driver") +
              "-origin",
          ),
      ).toBeVisible();
      await expect(
        fields
          .last()
          .getByTestId(
            "journey-art-" +
              (dropoffIndex === 3 ? "shared" : "driver") +
              "-destination",
          ),
      ).toBeVisible();
      await expect(merged.getByTestId("journey-art-shared")).toHaveCount(
        4 - expectedCount,
      );
      await expect(merged.getByTestId("journey-art-driver")).toHaveCount(
        expectedCount - 2,
      );
      await expect(merged.getByTestId("journey-art-passenger")).toHaveCount(
        expectedCount - 2,
      );
      const expected = [
        post.originLabel,
        ...(pickupIndex !== 0 ? ["Rider pickup"] : []),
        ...(dropoffIndex !== 3 ? ["Rider destination"] : []),
        post.destinationLabel.split(",")[0],
      ];
      for (let i = 0; i < expected.length; i++) {
        await expect(
          fields.nth(i).getByText(expected[i], { exact: true }),
        ).toBeVisible();
      }
      await expect(merged.getByText(/Cả hai/)).toHaveCount(4 - expectedCount);
      await expect(page.getByTestId("request-pickup")).toHaveCount(0);
      await expect(page.getByTestId("request-dropoff")).toHaveCount(0);
      await expect(page.getByTestId("journey-trail")).toBeVisible();
      await page
        .getByRole("button", { name: "Mở thông tin hành trình", exact: true })
        .click();
      await expect(page.getByTestId("confirmed-route-map")).toBeVisible();
      await expect(
        page
          .getByTestId("confirmed-route-map")
          .frameLocator("iframe")
          .locator("body"),
      ).toHaveAttribute("data-marker-count", String(expectedCount));
      if (pickupIndex === 0 && dropoffIndex === 3) {
        const preview = page
          .getByTestId("confirmed-route-map")
          .frameLocator("iframe");
        await preview
          .locator("body")
          .evaluate(() =>
            (
              window as unknown as { testMap: { emit: (type: string) => void } }
            ).testMap.emit("click"),
          );
        const expanded = page.getByTestId("expanded-route-map");
        await expect(expanded).toBeVisible();
        const map = expanded.frameLocator("iframe");
        await expect(map.locator("body")).toHaveAttribute(
          "data-marker-count",
          String(expectedCount),
        );
        await expect(map.locator(".dike-map-label")).toHaveCount(expectedCount);
        await expect(map.locator(".dike-map-label").first()).toHaveText(
          post.originLabel.split(",")[0],
        );
        const memberLink = map.locator(".dike-marker-person").first();
        const memberId = await memberLink.getAttribute("data-member");
        await memberLink.click();
        await expect(page).toHaveURL(new RegExp("/user/" + memberId + "$"));
        await page.goBack();
        await expect(expanded).toBeVisible();
        const original = await map.locator("body").evaluate(() => {
          const state = window as unknown as {
            mapInstance: number;
            mapOptions: { interactive: boolean };
          };
          return {
            instance: state.mapInstance,
            interactive: state.mapOptions.interactive,
          };
        });
        expect(original.interactive).toBe(true);
        const satellite = map.getByRole("button", {
          name: "Xem bản đồ vệ tinh",
          exact: true,
        });
        await satellite.click();
        await expect(map.locator("body")).toHaveAttribute(
          "data-layer",
          "satellite",
        );
        await expect(satellite).toHaveAttribute("aria-pressed", "true");
        expect(
          await map
            .locator("body")
            .evaluate(
              () => (window as unknown as { mapInstance: number }).mapInstance,
            ),
        ).toBe(original.instance);
        await satellite.click();
        await expect(map.locator("body")).toHaveAttribute("data-layer", "map");
        await expanded
          .getByRole("button", { name: "Quay lại", exact: true })
          .click();
        await expect(page.getByTestId("confirmed-post-detail")).toBeVisible();
      }
      await page.screenshot({
        path:
          "test-results/merged-journey-" +
          expectedCount +
          "-" +
          pickupIndex +
          ".png",
      });
    },
  );
}
