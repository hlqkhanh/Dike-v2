import { expect, test } from "@playwright/test";

const baseReport = {
  id: "report-1",
  reporterId: "reporter-1",
  targetType: "USER",
  targetId: "unsafe-user",
  reason: "UNSAFE",
  status: "IN_REVIEW",
  priority: "P1",
  assignedTo: "admin-user",
  contextBookingId: "booking-1",
  note: "Hành vi không an toàn tại điểm đón",
  evidenceSnapshot: {
    bookingStatus: "COMPLETED",
    messageExcerpt: "Nội dung bằng chứng",
  },
  createdAt: "2026-10-10T01:00:00Z",
  updatedAt: "2026-10-10T02:00:00Z",
  version: 3,
};

test.beforeEach(async ({ page, context }) => {
  await context.addCookies([
    { name: "XSRF-TOKEN", value: "csrf-admin", url: "http://127.0.0.1:3100" },
  ]);
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill({
      json: {
        authenticated: true,
        user: { id: "admin-user", displayName: "Quản trị viên" },
        session: { id: "admin-session" },
      },
    }),
  );
  await page.route("**/api/v1/social/revision", (route) =>
    route.fulfill({ json: { revision: 1 } }),
  );
  await page.route("**/api/v1/realtime/tickets", (route) =>
    route.fulfill({
      json: {
        ticket: "admin-e2e-ticket",
        websocketUrl: "ws://127.0.0.1:1/realtime",
        expiresAt: "2099-01-01T00:00:00Z",
      },
    }),
  );
});

test("moderation queue filters reports and preserves controls in the URL", async ({
  page,
}) => {
  await page.route("**/api/v1/admin/reports**", (route) =>
    route.fulfill({
      json: [
        baseReport,
        {
          ...baseReport,
          id: "report-2",
          targetType: "POST",
          targetId: "post-2",
          reason: "SPAM",
          status: "RECEIVED",
          priority: "P3",
        },
      ],
    }),
  );
  await page.goto("/admin");
  await expect(page.getByRole("link", { name: /Không an toàn/ })).toBeVisible();
  await page.getByLabel("Lọc loại đối tượng").selectOption("USER");
  await page.getByPlaceholder("Tìm report ID, target ID…").fill("unsafe-user");
  await expect(page).toHaveURL(/target=USER/);
  await expect(page).toHaveURL(/q=unsafe-user/);
  await expect(page.getByRole("link", { name: /Spam/ })).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("Lọc loại đối tượng")).toHaveValue("USER");
  await expect(page.getByPlaceholder("Tìm report ID, target ID…")).toHaveValue(
    "unsafe-user",
  );
});

test("admin prioritizes and resolves a report with an audit trail", async ({
  page,
}) => {
  let report: typeof baseReport & {
    resolutionCode?: string;
    resolutionNote?: string;
    resolvedAt?: string;
  } = { ...baseReport };
  let priorityCalls = 0;
  let transitionCalls = 0;
  await page.route("**/api/v1/admin/reports/report-1", (route) =>
    route.fulfill({ json: report }),
  );
  await page.route("**/api/v1/admin/audit?**", (route) =>
    route.fulfill({
      json: [
        {
          id: "audit-1",
          actorUserId: "admin-user",
          actorRole: "ADMIN",
          action: "REPORT_CLAIMED",
          targetType: "REPORT",
          targetId: "report-1",
          reportId: "report-1",
          safeBefore: {},
          safeAfter: { status: "IN_REVIEW", version: "3" },
          occurredAt: "2026-10-10T02:00:00Z",
        },
      ],
    }),
  );
  await page.route(
    "**/api/v1/admin/reports/report-1/priority",
    async (route) => {
      priorityCalls++;
      expect(route.request().postDataJSON()).toEqual({
        priority: "P0",
        version: 3,
      });
      report = { ...report, priority: "P0", version: 4 };
      await route.fulfill({ json: report });
    },
  );
  await page.route(
    "**/api/v1/admin/reports/report-1/transitions",
    async (route) => {
      transitionCalls++;
      expect(route.request().postDataJSON()).toEqual({
        status: "RESOLVED",
        resolutionCode: "SAFETY_ACTION_TAKEN",
        note: "Đã xác minh và áp dụng biện pháp an toàn",
        version: 4,
      });
      report = {
        ...report,
        status: "RESOLVED",
        resolutionCode: "SAFETY_ACTION_TAKEN",
        resolutionNote: "Đã xác minh và áp dụng biện pháp an toàn",
        resolvedAt: "2026-10-10T03:00:00Z",
        version: 5,
      };
      await route.fulfill({ json: report });
    },
  );

  await page.goto("/admin/reports/report-1");
  await expect(page.getByText("Nhận xử lý báo cáo")).toBeVisible();
  await page.getByLabel("Mức ưu tiên").selectOption("P0");
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Xác nhận" }).click();
  await expect(
    page.locator(".moderation-priority", { hasText: "P0 · Khẩn cấp" }),
  ).toBeVisible();
  await page.getByLabel("Kết luận báo cáo").selectOption("SAFETY_ACTION_TAKEN");
  await page
    .getByLabel("Ghi chú kết luận")
    .fill("Đã xác minh và áp dụng biện pháp an toàn");
  await page.getByRole("button", { name: "Giải quyết" }).click();
  await page.getByRole("button", { name: "Xác nhận" }).click();
  await expect(page.getByText("Đã giải quyết", { exact: true })).toBeVisible();
  await expect(page.getByText(/Đã xác minh và áp dụng/)).toBeVisible();
  expect(priorityCalls).toBe(1);
  expect(transitionCalls).toBe(1);
});

test("remote version conflict never overwrites the report", async ({
  page,
}) => {
  let detailCalls = 0;
  await page.route("**/api/v1/admin/reports/report-1", (route) => {
    detailCalls++;
    return route.fulfill({
      json:
        detailCalls > 1
          ? { ...baseReport, priority: "P0", version: 4 }
          : baseReport,
    });
  });
  await page.route("**/api/v1/admin/audit?**", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route("**/api/v1/admin/reports/report-1/priority", (route) =>
    route.fulfill({
      status: 409,
      json: {
        error: {
          code: "MODERATION_VERSION_CONFLICT",
          message: "Báo cáo đã thay đổi.",
        },
      },
    }),
  );

  await page.goto("/admin/reports/report-1");
  await page.getByLabel("Mức ưu tiên").selectOption("P0");
  await page.getByRole("button", { name: "Xác nhận" }).click();
  await expect(
    page.getByText("Báo cáo vừa được cập nhật ở nơi khác"),
  ).toBeVisible();
  await expect(
    page.locator(".moderation-priority", { hasText: "P1 · Ưu tiên cao" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tải dữ liệu mới" }).click();
  await expect(
    page.locator(".moderation-priority", { hasText: "P0 · Khẩn cấp" }),
  ).toBeVisible();
});
