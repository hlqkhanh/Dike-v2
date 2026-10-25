import { selectRoute, scheduleTrip } from "./journey-helpers";
import { test, expect } from "@playwright/test";
import { setup, noOverflow } from "./fixtures";

test("Google sign-in and design gallery remain readable on narrow and wide phones", async ({
  page,
}) => {
  await setup(page, { authenticated: false });
  for (const width of [360, 430]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/sign-in");
    await expect(
      page.getByRole("button", { name: "Đăng nhập bằng Google", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Xem thử giao diện", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Tiếp tục với token", exact: true }),
    ).toHaveCount(0);
    await noOverflow(page);
    await page.screenshot({ path: `test-results/sign-in-${width}.png` });
    await page.goto("/ui-gallery");
    await expect(page.getByText("Bộ giao diện Dike")).toBeVisible();
    await noOverflow(page);
  }
});

test("all member screens render and links work", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await setup(page);
  for (const [path, text] of [
    ["/", "Người cùng đường"],
    ["/trips", "Hành trình của bạn"],
    ["/inbox", "Thu Hà"],
    ["/profile", "Góc của bạn"],
    ["/notifications", "Hành trình mới"],
    ["/settings", "Thông tin cá nhân"],
    ["/settings/profile", "Tên hiển thị"],
    ["/settings/privacy", "Ai xem được hồ sơ?"],
    ["/settings/security", "Máy tính cũ"],
    ["/settings/consent", "Điều khoản sử dụng"],
    ["/settings/notifications", "Thông báo trên thiết bị"],
    ["/verification", "Minh Anh"],
    ["/schedules", "Lịch đi học"],
    ["/schedules/edit", "Tên lịch trình"],
    ["/posts/post-1", "Thu Hà"],
    ["/trip/trip-1", "Tiến trình chuyến đi"],
    ["/user/other", "Thu Hà"],
  ]) {
    await page.goto(path);
    await expect(page.getByText(text, { exact: false }).first()).toBeVisible();
    await noOverflow(page);
    await page.screenshot({
      path: `test-results/screen-${path.replaceAll("/", "_") || "feed"}.png`,
    });
  }
  await page.goto("/booking/booking-1");
  await expect(
    page.getByText("Bạn là người chở", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/screen-booking.png" });
  expect(errors).toEqual([]);
});

test("privacy updates use the displayed version and persist after refetch", async ({
  page,
}) => {
  const captured = await setup(page);
  await page.goto("/settings/privacy");
  await page.getByRole("button", { name: "Chỉ mình tôi", exact: true }).click();
  await page
    .getByRole("button", { name: "Lưu quyền riêng tư", exact: true })
    .click();
  await expect
    .poll(() => captured.find((r) => r.method === "PATCH")?.body)
    .toMatchObject({ profileVisibility: "PRIVATE", expectedVersion: 2 });
});

test("post request validates pickup before sending", async ({ page }) => {
  const captured = await setup(page);
  await page.goto("/posts/post-1");
  await page
    .getByRole("button", { name: "Gửi yêu cầu đi ké", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Gửi yêu cầu", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Kiểm tra điểm đón", exact: true })
    .click();
  await page.getByRole("button", { name: "Gửi yêu cầu", exact: true }).click();
  await expect
    .poll(() => captured.find((r) => r.path.endsWith("/responses"))?.body)
    .toMatchObject({ pickupCheckId: "pickup-1" });
});

test("retrying a message preserves clientMessageId", async ({ page }) => {
  const captured = await setup(page, { failFirstMessage: true });
  await page.goto("/chat/conversation-1");
  await page
    .getByLabel("Tin nhắn", { exact: true })
    .fill("Chào bạn, mình cùng đi nhé!");
  await page.getByRole("button", { name: "Gửi tin nhắn", exact: true }).click();
  await page
    .getByRole("button", { name: "Gửi lại tin nhắn", exact: true })
    .click();
  await expect(
    page.getByText("Chào bạn, mình cùng đi nhé!", { exact: true }),
  ).toBeVisible();
  const sends = captured.filter((r) => r.path.endsWith("/messages"));
  expect(sends).toHaveLength(2);
  expect(sends[0].body.clientMessageId).toEqual(sends[1].body.clientMessageId);
});

test("schedule status updates use If-Match", async ({ page }) => {
  const captured = await setup(page);
  await page.goto("/schedules");
  await page
    .getByRole("button", { name: "Tạm dừng lịch", exact: true })
    .click();
  await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect
    .poll(() => captured.find((r) => r.path.endsWith("/pause"))?.version)
    .toBe("1");
});

test("feed errors offer a retry without showing fake data", async ({
  page,
}) => {
  await setup(page, { failFeed: true });
  await page.goto("/");
  await expect(
    page.getByText("Chưa tải được hành trình", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Thử lại", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Thu Hà", { exact: true })).toHaveCount(0);
});

test("private deep links return unauthenticated users to sign-in", async ({
  page,
}) => {
  await setup(page, { authenticated: false });
  await page.goto("/trip/trip-1");
  await expect(
    page.getByRole("button", { name: "Đăng nhập bằng Google", exact: true }),
  ).toBeVisible();
});

test("publishing resumes after failure without creating a second trip or post", async ({
  page,
}) => {
  const captured = await setup(page, { failFirstOpen: true });
  await page.goto("/create-trip");
  await selectRoute(page, "driver");
  const tomorrow = new Date(Date.now() + 86_400_000);
  const date = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")} 10:00`;
  await scheduleTrip(page, date);
  await page
    .getByRole("button", { name: "Xe của Minh Anh, 3 chỗ", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Tìm người đi cùng", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Đăng bài của tôi", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Đăng hành trình", exact: true })
    .click();
  await expect(
    page.getByText("Chưa mở được chuyến. Thử lại.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Đăng hành trình", exact: true })
    .click();
  await expect(page).toHaveURL(/\/posts\/new-post$/);
  expect(
    captured.filter((r) => r.path === "/trips" && r.method === "POST"),
  ).toHaveLength(1);
  expect(
    captured.filter((r) => r.path === "/ride-posts" && r.method === "POST"),
  ).toHaveLength(1);
  const opens = captured.filter((r) => r.path.endsWith("/open"));
  expect(opens).toHaveLength(2);
  expect(opens[0].key).toEqual(opens[1].key);
});

test("backend nextAction sends members to onboarding", async ({ page }) => {
  await setup(page, { nextAction: "SUBMIT_PHONE" });
  await page.goto("/create-trip");
  await expect(
    page.getByText("Xác minh điện thoại", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Số điện thoại", { exact: true })).toBeVisible();
});

test("OTP resend keeps the updated phone version and verification resumes the app", async ({
  page,
}) => {
  const captured = await setup(page, { nextAction: "SUBMIT_PHONE" });
  await page.goto("/");
  await page.getByLabel("Số điện thoại", { exact: true }).fill("0912345678");
  await page
    .getByRole("button", { name: "Gửi mã xác nhận", exact: true })
    .click();
  await page.getByRole("button", { name: "Gửi lại mã", exact: true }).click();
  expect(captured.filter((r) => r.path === "/auth/phone")).toHaveLength(1);
  const otp = captured.filter((r) => r.path === "/auth/otp");
  expect(otp).toHaveLength(2);
  expect(otp.map((r) => r.body.phoneVersion)).toEqual([2, 2]);
  await page.getByLabel("Mã OTP", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(
    page.getByText("Người cùng đường", { exact: true }),
  ).toBeVisible();
});

test("booking action requires confirmation and sends the visible version", async ({
  page,
}) => {
  const captured = await setup(page);
  await page.goto("/booking/booking-1");
  await page
    .getByRole("button", { name: "Đã đến điểm đón", exact: true })
    .click();
  expect(captured.filter((r) => r.path.endsWith("/actions"))).toHaveLength(0);
  await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect
    .poll(() => captured.find((r) => r.path.endsWith("/actions"))?.body)
    .toMatchObject({ version: 4, action: "ARRIVE" });
  await expect(page.getByText("Đã đến đón", { exact: true })).toBeVisible();
});

test("notification deep link marks the notification read before opening the post", async ({
  page,
}) => {
  const captured = await setup(page);
  await page.goto("/notifications");
  await page.getByText("Hành trình mới", { exact: true }).click();
  await expect(page).toHaveURL(/\/posts\/post-1$/);
  expect(
    captured.some(
      (r) =>
        r.path === "/notifications/notification-1/read" && r.method === "PATCH",
    ),
  ).toBe(true);
});

test("expired sessions remove the stored credential and return to Google sign-in", async ({
  page,
}) => {
  await setup(page, { expireNotifications: true });
  await page.goto("/notifications");
  await expect(
    page.getByRole("button", { name: "Đăng nhập bằng Google", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      window.sessionStorage.getItem("dike.mobile.session"),
    ),
  ).toBeNull();
});

test("feed pagination appends results and filters by role", async ({
  page,
}) => {
  await setup(page, { paginatedFeed: true });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Xem thêm hành trình", exact: true })
    .click();
  await expect(page.getByText("Tuấn Minh", { exact: true })).toBeVisible();
  await expect(page.getByText("Thu Hà", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Tôi đi ké", exact: true }).click();
  await expect(page.getByText("Thu Hà", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Tuấn Minh", { exact: true })).toBeVisible();
});

test("reports and blocking require a real successful API response", async ({
  page,
}) => {
  const captured = await setup(page);
  await page.goto("/user/other");
  await page
    .getByRole("button", { name: "Báo cáo người dùng", exact: true })
    .click();
  await page
    .getByLabel("Thông tin bổ sung", { exact: true })
    .fill("Nội dung cần được kiểm tra.");
  await page.getByRole("button", { name: "Gửi báo cáo", exact: true }).click();
  await expect(
    page.getByText("Dike đã nhận báo cáo.", { exact: false }),
  ).toBeVisible();
  await expect
    .poll(() => captured.find((r) => r.path === "/reports")?.body)
    .toMatchObject({ targetType: "USER", targetId: "other", reason: "UNSAFE" });
  await page.getByRole("button", { name: "Đóng", exact: true }).last().click();
  await page
    .getByRole("button", { name: "Chặn người dùng", exact: true })
    .click();
  await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Bỏ chặn người dùng", exact: true }),
  ).toBeVisible();
});
