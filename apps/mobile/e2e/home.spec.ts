import { selectRoute } from "./journey-helpers";
import { test, expect } from "@playwright/test";
import { setup, noOverflow } from "./fixtures";

test("home uses shared artwork, filters empty results and opens the chosen travel role", async ({
  page,
}) => {
  await setup(page);
  await page.route("**/api/v1/ride-posts/post-1/route", (route) =>
    route.fulfill({
      json: {
        geometry: [
          { latitude: 10.841, longitude: 106.81 },
          { latitude: 10.83, longitude: 106.8 },
          { latitude: 10.81, longitude: 106.78 },
          { latitude: 10.78, longitude: 106.7 },
        ],
        distanceMeters: 14000,
        durationSeconds: 1800,
        provider: "test",
      },
    }),
  );
  await page.goto("/");
  await expect(page.getByText("Thu Hà", { exact: true })).toBeVisible();
  for (const width of [360, 430]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.getByRole("tab", { name: "Trang chủ", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      page.getByRole("button", { name: "Tạo hành trình", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Bản đồ tuyến đường thực tế", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Tạo hành trình mới", exact: true }),
    ).toHaveCount(0);
    await noOverflow(page);
    if (process.env.DIKE_TEST_LIVE_MAP)
      await expect(
        page.frameLocator('iframe[title="Bản đồ tuyến đường"]').locator("body"),
      ).toHaveAttribute("data-state", "ready", { timeout: 30000 });
    await page.screenshot({ path: `test-results/home-redesign-${width}.png` });
  }
  for (const width of [360, 430]) {
    await page.setViewportSize({ width, height: 900 });
    await page
      .getByLabel("Tìm hành trình", { exact: true })
      .fill("Không có tuyến này");
    await expect(
      page.getByText("Chưa có chuyến phù hợp", { exact: true }),
    ).toBeVisible();
    await noOverflow(page);
    await page.screenshot({ path: `test-results/home-empty-${width}.png` });
  }
  await page
    .getByRole("button", {
      name: "Tôi đi ké · Tìm chuyến phù hợp",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/mode=passenger/);
  await expect(
    page.getByText("Phương tiện đã duyệt", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Quay lại", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Tôi chở · Đăng chuyến đi chung",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/mode=driver/);
  await selectRoute(page, "driver");
  await expect(
    page.getByRole("button", { name: "Xe của Minh Anh, 3 chỗ", exact: true }),
  ).toBeVisible();
});

test("home shows an honest unavailable state when the route has no coordinates", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/");
  await expect(
    page.getByText("Chưa có tuyến đường", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Minh họa", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Tạo hành trình", exact: true })
    .click();
  await expect(page).toHaveURL(/create-trip/);
});
