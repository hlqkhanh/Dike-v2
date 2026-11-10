import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/session"))
      return route.fulfill({
        json: {
          authenticated: true,
          user: { id: "viewer", displayName: "Minh Anh" },
          session: { id: "session" },
        },
      });
    if (path.endsWith("/social/revision"))
      return route.fulfill({ json: { revision: 1 } });
    if (path.endsWith("/realtime/tickets"))
      return route.fulfill({ status: 503, json: {} });
    if (path.endsWith("/bookings"))
      return route.fulfill({ json: { items: [], nextCursor: null } });
    return route.fulfill({ json: [] });
  });
});

test("bubble opens in the corner and preserves text when minimized and navigating", async ({
  page,
}) => {
  await page.route("**/assistant/conversations", (route) =>
    route.fulfill({ json: { id: "conversation-123456" } }),
  );
  await page.route("**/assistant/conversations/*/messages", (route) =>
    route.fulfill({
      json: {
        text: "Mở chi tiết booking để kiểm tra và hủy nếu được phép.",
        draft: null,
        bookings: [],
        checkedAt: null,
        source: {
          id: "cancel-v1",
          title: "Hủy chuyến hoặc booking",
          action: "BOOKINGS",
        },
      },
    }),
  );
  await page.goto("/schedules");
  const launcher = page.getByRole("button", {
    name: "Mở trợ lý Dike",
    exact: true,
  });
  await expect(launcher).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Trợ lý Dike" })).toHaveCount(
    0,
  );
  await launcher.click();
  const panel = page.getByRole("dialog", { name: "Trợ lý Dike" });
  await expect(panel).toBeVisible();
  const bounds = await panel.boundingBox();
  const viewport = page.viewportSize()!;
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
  await page.getByLabel("Tin nhắn của bạn").fill("Nội dung đang nhập");
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await launcher.click();
  await expect(page.getByLabel("Tin nhắn của bạn")).toHaveValue(
    "Nội dung đang nhập",
  );
  await page.getByRole("button", { name: "Thu nhỏ khung chat" }).click();
  await launcher.click();
  await page.getByText("Gợi ý nhanh", { exact: true }).click();
  await page.screenshot({
    path: test.info().outputPath("assistant-quick-cards.png"),
  });
  await page
    .getByRole("button", {
      name: "Hướng dẫn: Hủy chuyến hoặc booking",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Tin nhắn của bạn")
    .fill("Giữ nội dung khi chuyển trang");
  await page.getByRole("button", { name: "Thu nhỏ khung chat" }).click();
  await page.getByRole("link", { name: "Tạo lịch trình", exact: true }).click();
  await expect(page).toHaveURL(/\/schedules\/new$/, { timeout: 20000 });
  await launcher.click();
  await expect(panel).toBeVisible();
  await expect(page.getByLabel("Tin nhắn của bạn")).toHaveValue(
    "Giữ nội dung khi chuyển trang",
  );
  await page.screenshot({
    path: test.info().outputPath("assistant-bubble.png"),
  });
});

test("schedule draft survives help, resolves places and saves only on confirmation", async ({
  page,
}) => {
  let confirmations = 0;
  const draft = {
    id: "draft-123456",
    kind: "SCHEDULE",
    version: 1,
    fields: {
      name: "Đi học",
      originQuery: "Thủ Đức",
      destinationQuery: "ĐH FPT",
      date: "2026-12-01",
      until: "2026-12-31",
      role: "RIDER",
      category: "STUDY",
      weekdays: "MONDAY,TUESDAY",
      startTime: "08:00",
      endTime: "17:00",
      directions: "OUTBOUND,RETURN",
      buffer: "10",
    },
  };
  await page.route("**/assistant/conversations", (route) =>
    route.fulfill({ json: { id: "conversation-123456", draft: null } }),
  );
  await page.route("**/assistant/conversations/*/messages", (route) => {
    const help = route.request().postDataJSON().text.startsWith("Hướng dẫn:");
    return route.fulfill({
      json: {
        text: help ? "Mở chi tiết để hủy." : "Kiểm tra bản nháp rồi xác nhận.",
        draft,
        source: help
          ? {
              id: "cancel-v1",
              title: "Hủy chuyến hoặc booking",
              action: "BOOKINGS",
            }
          : null,
        bookings: [],
        checkedAt: null,
      },
    });
  });
  await page.route("**/routing/place-sessions", (route) =>
    route.fulfill({
      json: {
        sessionToken: "place-session",
        expiresAt: "2026-12-31T00:00:00Z",
      },
    }),
  );
  await page.route("**/routing/places?*", (route) =>
    route.fulfill({
      json: [
        {
          placeRef: "place-123456",
          displayLabel: "Địa chỉ đã xác minh",
          mainText: "Địa chỉ",
          secondaryText: "TP.HCM",
        },
      ],
    }),
  );
  await page.route("**/routing/places/resolve", (route) =>
    route.fulfill({
      json: {
        placeRef: "place-123456",
        displayLabel: "Địa chỉ đã xác minh",
        latitude: 10.8,
        longitude: 106.7,
      },
    }),
  );
  await page.route("**/assistant/conversations/*/confirm", (route) => {
    confirmations++;
    expect(route.request().postDataJSON().fields.name).toBe("Đi học buổi sáng");
    return route.fulfill({
      json: { id: "schedule-created", kind: "SCHEDULE", warnings: [] },
    });
  });
  await page.goto("/schedules");
  await page
    .getByRole("button", { name: "Mở trợ lý Dike", exact: true })
    .click();
  await page
    .getByLabel("Tin nhắn của bạn")
    .fill("Tạo lịch đi học thứ hai và thứ ba");
  await page.getByRole("button", { name: "Gửi tin nhắn", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Bản nháp lịch định kỳ" }),
  ).toBeVisible();
  expect(confirmations).toBe(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: test.info().outputPath("assistant-draft.png"),
    fullPage: true,
  });
  await page.getByLabel("Tên lịch", { exact: true }).fill("Đi học buổi sáng");
  await page.getByText("Gợi ý nhanh", { exact: true }).click();
  await page
    .getByRole("button", {
      name: "Hướng dẫn: Hủy chuyến hoặc booking",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Tên lịch", { exact: true })).toHaveValue(
    "Đi học buổi sáng",
  );
  for (let i = 0; i < 2; i++) {
    await page
      .getByRole("button", { name: "Tìm địa chỉ chính xác", exact: true })
      .nth(i)
      .click();
    await page
      .getByRole("button", { name: "Địa chỉ đã xác minh", exact: true })
      .click();
  }
  await page
    .getByRole("button", { name: "Xác nhận lưu lịch", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Đã lưu thành công" }),
  ).toBeVisible();
  expect(confirmations).toBe(1);
});

test("provider failure preserves input and offers manual form", async ({
  page,
}) => {
  await page.route("**/assistant/conversations", (route) =>
    route.fulfill({ json: { id: "conversation-123456" } }),
  );
  await page.route("**/assistant/conversations/*/messages", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: {
          code: "ASSISTANT_NOT_CONFIGURED",
          message: "Nhập bằng AI chưa được bật.",
        },
      },
    }),
  );
  await page.goto("/schedules");
  await page
    .getByRole("button", { name: "Mở trợ lý Dike", exact: true })
    .click();
  await page.getByLabel("Tin nhắn của bạn").fill("Mai mình muốn đi học");
  await page.getByRole("button", { name: "Gửi tin nhắn", exact: true }).click();
  await expect(page.locator(".assistant-error")).toContainText(
    "Nhập bằng AI chưa được bật",
  );
  await expect(page.getByLabel("Tin nhắn của bạn")).toHaveValue(
    "Mai mình muốn đi học",
  );
  await expect(
    page.getByRole("link", { name: "Dùng form tạo chuyến" }),
  ).toHaveCount(0);
  await page.screenshot({
    path: test.info().outputPath("assistant-error-inline.png"),
  });
  await expect(page.locator(".assistant-toast")).toHaveCount(0);
  await expect(
    page.getByRole("alert").filter({ hasText: "Chưa thực hiện được" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Tin nhắn của bạn")).toHaveValue(
    "Mai mình muốn đi học",
  );
});

test("invalid ride fields turn red and focus the first invalid input", async ({
  page,
}) => {
  await page.route("**/assistant/conversations", (route) =>
    route.fulfill({ json: { id: "validation-chat" } }),
  );
  await page.route("**/assistant/conversations/*/messages", (route) =>
    route.fulfill({
      json: {
        text: "Kiểm tra bản nháp",
        draft: {
          id: "validation-draft",
          kind: "INTENT",
          version: 1,
          fields: {
            originQuery: "Thủ Đức",
            destinationQuery: "ĐH FPT",
            date: "2099-01-01",
            seats: "2",
          },
        },
        source: null,
        bookings: [],
        checkedAt: null,
      },
    }),
  );
  await page.goto("/schedules");
  await page
    .getByRole("button", { name: "Mở trợ lý Dike", exact: true })
    .click();
  await page.getByLabel("Tin nhắn của bạn").fill("Tạo chuyến đi");
  await page.getByRole("button", { name: "Gửi tin nhắn", exact: true }).click();
  await page
    .getByRole("button", { name: "Tìm bài phù hợp và đăng bài", exact: true })
    .click();
  const origin = page.locator('[data-assistant-field="originQuery"] input');
  await expect(origin).toBeFocused();
  for (const key of [
    "originQuery",
    "destinationQuery",
    "role",
    "departureTime",
    "seats",
  ])
    await expect(
      page
        .locator(`[data-assistant-field="${key}"]`)
        .locator("input, select")
        .first(),
    ).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.locator('[data-assistant-field="originQuery"] .assistant-field-error'),
  ).toContainText("chính xác");
  await expect(page.locator(".assistant-toast")).toHaveCount(0);
  await expect(origin).toHaveAttribute("aria-invalid", "true");
  await origin.fill("Địa chỉ mới");
  await expect(origin).toHaveAttribute("aria-invalid", "false");
  await expect(
    page.locator('[data-assistant-field="destinationQuery"] input'),
  ).toHaveAttribute("aria-invalid", "true");
});

test("booking answers show service data and no mutation action", async ({
  page,
}) => {
  await page.route("**/assistant/conversations", (route) =>
    route.fulfill({ json: { id: "conversation-123456" } }),
  );
  await page.route("**/assistant/conversations/*/messages", (route) =>
    route.fulfill({
      json: {
        text: "Đây là booking của bạn.",
        draft: null,
        source: null,
        checkedAt: "2026-11-11T00:00:00Z",
        bookings: [
          {
            id: "booking-owned",
            status: "CONFIRMED",
            pickupAt: "2026-11-11T01:00:00Z",
            role: "RIDER",
          },
        ],
      },
    }),
  );
  await page.goto("/schedules");
  await page
    .getByRole("button", { name: "Mở trợ lý Dike", exact: true })
    .click();
  await page.getByText("Gợi ý nhanh", { exact: true }).click();
  await page
    .getByRole("button", { name: "Xem booking của tôi", exact: true })
    .click();
  await expect(page.locator('a[href="/bookings/booking-owned"]')).toBeVisible();
  await expect(page.getByRole("button", { name: /^Xác nhận lưu/ })).toHaveCount(
    0,
  );
});
