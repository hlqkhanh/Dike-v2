import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function expectNoSeriousViolations(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  const serious = result.violations.filter((violation) =>
    ["critical", "serious"].includes(violation.impact ?? ""),
  );
  expect(
    serious,
    serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n"),
  ).toEqual([]);
}

test("public and offline shells have no serious accessibility violations", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill({
      status: 401,
      json: { error: { code: "AUTHENTICATION_REQUIRED" } },
    }),
  );
  await page.goto("/login");
  await expectNoSeriousViolations(page);
  await page.goto("/offline");
  await expectNoSeriousViolations(page);
});

test("simulated verification status is accessible", async ({ page }) => {
  const pageErrors: Error[] = [];
  let markAllCalls = 0;
  const notifications = [
    {
      id: "notification-1",
      type: "FRIEND_REQUEST",
      title: "Lời mời kết bạn",
      body: "Minh Trần muốn kết nối với bạn.",
      data: { userId: "friend-1" },
      createdAt: "2026-10-12T14:29:54Z",
      readAt: undefined as string | undefined,
    },
    {
      id: "notification-2",
      type: "TRIP_CONFIRMED",
      title: "Chuyến đi đã được xác nhận",
      body: "Hẹn bạn tại điểm đón lúc 17:45 hôm nay.",
      data: { tripId: "trip-1" },
      createdAt: "2026-10-12T15:29:54Z",
      readAt: undefined as string | undefined,
    },
  ];
  page.on("pageerror", (error) => pageErrors.push(error));
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill({
      json: {
        authenticated: true,
        user: {
          id: "synthetic-user",
          displayName: "Tài xế thử nghiệm",
          email: "synthetic@example.test",
          onboardingStatus: "PHONE_SUBMITTED",
          phoneStatus: "UNVERIFIED",
          phoneMasked: "+849••••567",
          phoneVersion: 1,
          verificationEvidence: "SIMULATED",
          driverApprovalEvidence: "SIMULATED",
          accessMode: "SIMULATED",
          authorities: ["MEMBER", "VERIFIED_MEMBER", "APPROVED_DRIVER"],
          authorizationVersion: 1,
          nextAction: "NONE",
        },
        session: {
          id: "synthetic-session",
          deviceLabel: "Playwright",
          createdAt: "2026-10-08T00:00:00Z",
          lastSeenAt: "2026-10-08T00:00:00Z",
          idleExpiresAt: "2026-10-09T00:00:00Z",
          absoluteExpiresAt: "2026-11-07T00:00:00Z",
          current: true,
        },
      },
    }),
  );
  await page.route("**/api/v1/realtime/tickets", (route) =>
    route.fulfill({
      status: 503,
      json: { error: { code: "REALTIME_TEMPORARILY_UNAVAILABLE" } },
    }),
  );
  await page.route("**/api/v1/social/revision", (route) =>
    route.fulfill({ json: { revision: 1 } }),
  );
  await page.route("**/api/v1/notifications/read-all", (route) => {
    markAllCalls += 1;
    notifications.forEach((item) => {
      item.readAt = "2026-10-12T15:30:00Z";
    });
    return route.fulfill({ status: 204 });
  });
  await page.route("**/api/v1/notifications", (route) =>
    route.fulfill({ json: notifications }),
  );
  await page.goto("/verification");
  await expect(
    page.getByRole("main").getByText("Tài xế thử nghiệm", { exact: true }),
  ).toBeVisible();
  await expectNoSeriousViolations(page);

  await page.getByRole("button", { name: "Thông báo, 2 chưa đọc" }).click();
  const notificationDialog = page.getByRole("dialog", { name: "Thông báo" });
  await expect(notificationDialog).toBeVisible();
  await expect(
    notificationDialog.getByText("2 thông báo chưa đọc"),
  ).toBeVisible();
  await expectNoSeriousViolations(page);

  await notificationDialog
    .getByRole("button", { name: "Đánh dấu tất cả đã đọc" })
    .click();
  await expect(
    notificationDialog.getByText("0 thông báo chưa đọc"),
  ).toBeVisible();
  expect(markAllCalls).toBe(1);
  await notificationDialog
    .getByRole("button", { name: "Đóng thông báo" })
    .click();
  await expect(notificationDialog).toBeHidden();

  await page.goto("/notifications");
  await expect(
    page.getByRole("heading", { name: "Thông báo", level: 1 }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Chuyến đi/ }).click();
  await expect(
    page.getByRole("heading", { name: "Chuyến đi thông báo" }),
  ).toBeVisible();
  await expect(
    page.getByText("Chuyến đi đã được xác nhận", { exact: true }),
  ).toBeVisible();
  await expectNoSeriousViolations(page);
  expect(pageErrors).toEqual([]);
});
