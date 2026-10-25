import { expect, test } from "@playwright/test";
import { setup, noOverflow } from "./fixtures";
import { selectRoute } from "./journey-helpers";

test("swiping vehicle options raises the whole card while the search action stays fixed", async ({
  page,
}) => {
  await setup(page);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/create-trip?mode=passenger");
  await selectRoute(page);
  const sheet = page.getByTestId("ride-options-sheet");
  const action = page.getByRole("button", {
    name: "Tìm chuyến phù hợp",
    exact: true,
  });
  const before = (await sheet.boundingBox())!;
  const actionBefore = (await action.boundingBox())!;
  await page
    .getByRole("button", { name: "Sửa tuyến đường", exact: true })
    .hover();
  await page.mouse.wheel(0, 240);
  await expect
    .poll(async () => (await sheet.boundingBox())!.y)
    .toBeLessThan(before.y - 100);
  await expect(action).toBeInViewport();
  expect((await action.boundingBox())!.y).toBeCloseTo(actionBefore.y, 0);
  await page.screenshot({ path: "test-results/journey-options-expanded.png" });
  await page.mouse.wheel(0, -600);
  await expect
    .poll(async () => (await sheet.boundingBox())!.y)
    .toBeGreaterThan(before.y - 5);
});

test("failed saved pickup can be retried or replaced manually", async ({
  page,
}) => {
  await setup(page);
  await page.addInitScript(() =>
    window.sessionStorage.setItem(
      "dike.places.member",
      JSON.stringify({
        configured: true,
        pickup: {
          displayLabel: "Điểm đi đã lưu",
          publicAreaLabel: "Hà Nội",
          latitude: 21.0167,
          longitude: 105.8117,
        },
        recent: [],
      }),
    ),
  );
  let attempts = 0;
  await page.route("**/api/v1/routing/places/reverse", async (route) => {
    attempts++;
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        error: { message: "Hệ thống không thể xử lý yêu cầu" },
      }),
    });
  });
  await page.goto("/create-trip?mode=passenger");
  const retry = page.getByRole("button", {
    name: "Thử lại điểm đi đã lưu",
    exact: true,
  });
  await expect(retry).toBeVisible();
  await retry.click();
  await expect.poll(() => attempts).toBe(2);
  await page.getByRole("button", { name: "Sửa điểm đi", exact: true }).click();
  await page.getByLabel("Điểm đi", { exact: true }).fill("FPT");
  await page.getByRole("button", { name: "Tìm địa điểm", exact: true }).click();
  await page.getByText("FPT", { exact: true }).click();
  await expect(retry).toHaveCount(0);
  await expect(
    page.getByText(/Chưa khôi phục được điểm đi đã lưu/),
  ).toHaveCount(0);
});

test("route details expand without crowding the vehicle panel", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/create-trip?mode=passenger");
  await selectRoute(page);
  await expect(
    page.getByRole("button", { name: "Tìm chuyến phù hợp", exact: true }),
  ).toBeInViewport();
  await page
    .getByRole("button", { name: "Xem chi tiết tuyến đường", exact: true })
    .click();
  await expect(
    page.getByText("Tuyến đường của bạn", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Sửa tuyến đường", exact: true })
    .last()
    .click();
  await expect(
    page.getByText("Bạn muốn đi đâu?", { exact: true }),
  ).toBeVisible();
});

test("first visit offers manual location and remembers the confirmed pickup", async ({
  page,
}) => {
  await setup(page, { firstVisit: true });
  await page.goto("/");
  await expect(
    page.getByText("Chọn điểm xuất phát của bạn", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/journey-welcome.png" });
  await page
    .getByRole("button", { name: "Chọn địa chỉ khác", exact: true })
    .click();
  await page.getByLabel("Điểm đi", { exact: true }).fill("FPT");
  await page.getByRole("button", { name: "Tìm địa điểm", exact: true }).click();
  await page.getByText("FPT", { exact: true }).click();
  await page
    .getByRole("button", { name: "Dùng địa chỉ này", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Thay đổi điểm đi mặc định",
      exact: true,
    }),
  ).toContainText("Đại học FPT");
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Thay đổi điểm đi mặc định",
      exact: true,
    }),
  ).toContainText("Đại học FPT");
  await page.screenshot({ path: "test-results/journey-home.png" });
  await page.goto("/create-trip?mode=passenger");
  await expect(
    page.getByRole("button", { name: "Sửa điểm đi", exact: true }),
  ).toContainText("Đại học FPT");
  await expect(
    page.getByRole("button", { name: "Chọn Đại học FPT", exact: true }),
  ).toBeVisible();
  await noOverflow(page);
});

test("location can be deferred and is not requested again on reload", async ({
  page,
}) => {
  await setup(page, { firstVisit: true });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Để sau, khám phá Diké", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Thay đổi điểm đi mặc định",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Chọn điểm xuất phát của bạn", { exact: true }),
  ).toHaveCount(0);
});

test("denied location permission leaves manual search available", async ({
  page,
}) => {
  await setup(page, { firstVisit: true });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (
          _success: unknown,
          failure: (error: { code: number; message: string }) => void,
        ) => failure({ code: 1, message: "Permission denied" }),
      },
    });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Dùng vị trí hiện tại", exact: true })
    .click();
  await expect(
    page.getByText(/quyền vị trí|Permission denied|denied/i).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Chọn địa chỉ khác", exact: true })
    .click();
  await expect(page.getByLabel("Điểm đi", { exact: true })).toBeEditable();
});

test("recent locations re-resolve references, deduplicate, and can be removed", async ({
  page,
}) => {
  const requests = await setup(page);
  await page.goto("/create-trip?mode=passenger");
  await selectRoute(page);
  await page
    .getByRole("button", { name: "Sửa tuyến đường", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Chọn Đại học FPT", exact: true }),
  ).toHaveCount(1);
  // Editing the pickup and choosing a recent result obtains a new owned reference.
  await page.getByRole("button", { name: "Sửa điểm đi", exact: true }).click();
  await page
    .getByRole("button", { name: "Chọn Đại học FPT", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Xác nhận điểm đón", exact: true }),
  ).toBeVisible();
  expect(
    requests.filter((r) => r.path === "/routing/places/reverse"),
  ).toHaveLength(1);
  await page.getByRole("button", { name: "Quay lại", exact: true }).click();
  await page
    .getByRole("button", { name: "Xóa Đại học FPT khỏi gần đây", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Chọn Đại học FPT", exact: true }),
  ).toHaveCount(0);
});

test("vehicle choice limits seats and search keeps a future departure", async ({
  page,
}) => {
  const requests = await setup(page);
  await page.goto("/create-trip?mode=passenger");
  await selectRoute(page);
  await page.getByRole("button", { name: "Ô tô", exact: true }).click();
  await page.getByRole("button", { name: "Tăng số chỗ", exact: true }).click();
  await page.getByRole("button", { name: "Xe máy", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Tăng số chỗ", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Tìm chuyến phù hợp", exact: true })
    .click();
  await expect(page.getByText("Thu Hà", { exact: true }).first()).toBeVisible();
  const search = requests.find((r) => r.path === "/ride-discovery")!;
  expect(search.body.seats).toBe(1);
  expect(Date.parse(String(search.body.departureAt))).toBeGreaterThan(
    Date.now(),
  );
  expect(requests.filter((r) => r.path === "/ride-posts")).toHaveLength(0);
});

test("moving the pickup pin ignores a delayed response for an older pin", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/create-trip?mode=passenger");
  await selectRoute(page);
  await page
    .getByRole("button", { name: "Sửa tuyến đường", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Kiểm tra điểm đón", exact: true })
    .click();
  const requests: { latitude: number; finish: () => Promise<void> }[] = [];
  await page.route("**/routing/places/reverse", async (route) => {
    const body = route.request().postDataJSON();
    requests.push({
      latitude: body.latitude,
      finish: () =>
        route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            ...body,
            placeRef: `pin-${body.latitude}`,
            displayLabel: `Điểm đón ${body.latitude}`,
            publicAreaLabel: "TP. Hồ Chí Minh",
            resolvedAt: new Date().toISOString(),
          }),
        }),
    });
  });
  const sendPin = (latitude: number) =>
    page
      .frameLocator('iframe[title="Bản đồ tuyến đường"]')
      .locator("body")
      .evaluate((_, lat) => {
        window.parent.postMessage(
          JSON.stringify({
            source: "dike-route-map",
            type: "pick",
            point: { latitude: lat, longitude: 106.7 },
          }),
          "*",
        );
      }, latitude);
  await sendPin(10.771);
  await expect.poll(() => requests.length).toBe(1);
  await expect(
    page.getByRole("button", { name: "Xác nhận điểm đón", exact: true }),
  ).toBeDisabled();
  await sendPin(10.772);
  await expect.poll(() => requests.length).toBe(2);
  await requests[1].finish();
  await expect(
    page.getByText("Điểm đón 10.772", { exact: true }),
  ).toBeVisible();
  await requests[0].finish();
  await expect(page.getByText("Điểm đón 10.771", { exact: true })).toHaveCount(
    0,
  );
  await page
    .getByRole("button", { name: "Xác nhận điểm đón", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Sửa tuyến đường", exact: true }),
  ).toContainText("Điểm đón 10.772");
});

test("pickup and vehicle screens keep their main action reachable on a narrow phone", async ({
  page,
}) => {
  await setup(page);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/create-trip?mode=passenger");
  await selectRoute(page);
  const action = page.getByRole("button", {
    name: "Tìm chuyến phù hợp",
    exact: true,
  });
  await expect(action).toBeInViewport();
  await noOverflow(page);
  await page.screenshot({ path: "test-results/journey-details-narrow.png" });
  await page
    .getByRole("button", { name: "Sửa tuyến đường", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Kiểm tra điểm đón", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Xác nhận điểm đón", exact: true }),
  ).toBeInViewport();
  await noOverflow(page);
});
