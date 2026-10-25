import { selectRoute } from "./journey-helpers";
import { test, expect } from "@playwright/test";
import { setup, noOverflow } from "./fixtures";

test("redesigned screens fit narrow and wide phones with readable shared artwork", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await setup(page);
  for (const width of [360, 430]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [path, text] of [
      ["/trips", "Hành trình của bạn"],
      ["/booking/booking-1", "Bạn là người chở"],
      ["/profile", "Minh Anh"],
      ["/schedules", "Lịch đi học"],
      ["/schedules/edit", "Tên lịch trình"],
      ["/settings", "Thông tin cá nhân"],
      ["/inbox", "Thu Hà"],
      ["/posts/post-1", "Thu Hà"],
      ["/trip/trip-1", "Tiến trình chuyến đi"],
      ["/create-trip", "Bạn muốn đi đâu?"],
      ["/chat/conversation-1", "Thu Hà"],
      ["/user/other", "Thu Hà"],
      ["/notifications", "Hành trình mới"],
      ["/settings/profile", "Tên hiển thị"],
      ["/settings/privacy", "Ai xem được hồ sơ?"],
      ["/settings/security", "Máy tính cũ"],
      ["/settings/consent", "Điều khoản sử dụng"],
      ["/settings/notifications", "Thông báo trên thiết bị"],
      ["/verification", "Minh Anh"],
      ["/onboarding/phone", "Số điện thoại"],
      ["/ui-gallery", "Bộ giao diện Dike"],
    ]) {
      await page.goto(path);
      await expect(
        page.getByText(text, { exact: false }).first(),
      ).toBeVisible();
      await noOverflow(page);
      await page.screenshot({
        path: `test-results/redesign-${width}-${path.replaceAll("/", "_")}.png`,
      });
    }
  }
});

test("trip form preserves notes and route through pickup confirmation and edits", async ({
  page,
}) => {
  const requests = await setup(page);
  await page.goto("/create-trip?mode=passenger");
  await selectRoute(page);
  await page
    .getByLabel("Lời nhắn (không bắt buộc)", { exact: true })
    .fill("Meet at the gate");
  await page
    .getByRole("button", { name: "Sửa tuyến đường", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Sửa điểm đi", exact: true }),
  ).toContainText("Đại học FPT");
  await page
    .getByRole("button", { name: "Hoán đổi tuyến", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Hoán đổi tuyến", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Kiểm tra điểm đón", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Xác nhận điểm đón", exact: true })
    .click();
  await expect(
    page.getByLabel("Lời nhắn (không bắt buộc)", { exact: true }),
  ).toHaveValue("Meet at the gate");
  expect(
    requests.filter((r) => ["/trips", "/ride-posts"].includes(r.path)),
  ).toEqual([]);
  await noOverflow(page);
});

test("schedule errors stay distinct from empty data and recover on retry", async ({
  page,
}) => {
  await setup(page);
  let unavailable = true;
  await page.route("**/api/v1/schedules", async (route) => {
    if (!unavailable) return route.fallback();
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: { message: "Máy chủ đang bận" } }),
    });
  });
  await page.goto("/schedules");
  await expect(
    page.getByText("Chưa thể tải dữ liệu", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Chưa có lịch trình", { exact: true }),
  ).toHaveCount(0);
  await page.screenshot({ path: "test-results/redesign-schedules-error.png" });
  unavailable = false;
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(page.getByText("Lịch đi học", { exact: true })).toBeVisible();
  await page.route("**/api/v1/trips", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ items: [], nextCursor: null }),
    }),
  );
  await page.goto("/trips");
  await expect(
    page.getByText("Chưa có hành trình ở đây", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Khám phá hành trình", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Tìm hành trình", exact: true }),
  ).toBeVisible();
});
