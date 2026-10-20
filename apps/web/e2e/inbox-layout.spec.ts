import { expect, test } from "@playwright/test";
import type { JourneyMessage } from "@dike/api-client-ts";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/notifications", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route("**/api/v1/realtime/tickets", (route) =>
    route.fulfill({
      status: 503,
      json: { error: { code: "REALTIME_UNAVAILABLE" } },
    }),
  );
});

test("messages open inline, send, switch and preserve safety cards on other tabs", async ({
  page,
  context,
  isMobile,
}) => {
  await context.addCookies([
    { name: "XSRF-TOKEN", value: "csrf", url: "http://127.0.0.1:3100" },
  ]);
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill({
      json: {
        authenticated: true,
        user: { id: "viewer", displayName: "Viewer" },
        session: { id: "session" },
      },
    }),
  );
  await page.route("**/api/v1/social/revision", (route) =>
    route.fulfill({ json: { revision: 1 } }),
  );
  await page.route("**/api/v1/friendships**", (route) =>
    route.fulfill({ json: { items: [], nextCursor: null } }),
  );
  await page.route("**/api/v1/blocks**", (route) =>
    route.fulfill({ json: { items: [], nextCursor: null } }),
  );
  const conversations = [
    {
      id: "direct-1",
      type: "DIRECT",
      state: "OPEN",
      participantIds: ["viewer", "other"],
      unreadCount: 1,
      version: 1,
    },
    {
      id: "trip-1",
      type: "BOOKING",
      state: "READ_ONLY",
      bookingId: "booking-1",
      participantIds: ["viewer", "driver"],
      unreadCount: 0,
      version: 1,
    },
  ];
  const messages: Record<string, JourneyMessage[]> = {
    "direct-1": [
      {
        id: "m1",
        conversationId: "direct-1",
        senderId: "other",
        clientMessageId: "c1",
        sequence: 1,
        text: "Chào bạn",
        createdAt: "2026-10-14T08:00:00Z",
        hidden: false,
      },
    ],
    "trip-1": [
      {
        id: "m2",
        conversationId: "trip-1",
        senderId: "driver",
        clientMessageId: "c2",
        sequence: 1,
        text: "Điểm đón ở cổng trường",
        createdAt: "2026-10-14T08:00:00Z",
        hidden: false,
      },
    ],
  };
  await page.route("**/api/v1/conversations", (route) =>
    route.fulfill({ json: conversations }),
  );
  await page.route("**/api/v1/conversations/*/read", (route) =>
    route.fulfill({ status: 204 }),
  );
  await page.route("**/api/v1/conversations/*/messages", async (route) => {
    const id = route.request().url().split("/").at(-2)!;
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      const message: JourneyMessage = {
        id: `sent-${messages[id].length + 1}`,
        conversationId: id,
        senderId: "viewer",
        clientMessageId: body.clientMessageId,
        sequence: messages[id].length + 1,
        text: body.text,
        createdAt: "2026-10-14T08:01:00Z",
        hidden: false,
      };
      messages[id].push(message);
      return route.fulfill({ json: message });
    }
    return route.fulfill({ json: messages[id] });
  });
  await page.goto("/friends");
  const safety = page.getByRole("heading", { name: "Mẹo kết nối an toàn" });
  await expect(safety).not.toBeVisible();
  const rows = page.getByRole("region", {
    name: "Danh sách hội thoại",
    exact: true,
  });
  await rows.getByRole("button", { name: /Hội thoại trực tiếp/ }).click();
  const detail = page.getByRole("region", {
    name: "Chi tiết hội thoại",
    exact: true,
  });
  await expect(detail.getByText("Chào bạn", { exact: true })).toBeVisible();
  const toolbar = detail.locator(".conversation-toolbar");
  await expect(toolbar.getByRole("heading")).toBeVisible();
  await expect(
    toolbar.getByRole("button", { name: "Gọi điện", exact: true }),
  ).toBeDisabled();
  await expect(
    toolbar.getByText("Đang trò chuyện", { exact: true }),
  ).toHaveCount(0);
  await toolbar.getByLabel("Tùy chọn hội thoại", { exact: true }).click();
  await expect(
    toolbar.getByRole("link", { name: "Xem hồ sơ", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    toolbar.getByRole("link", { name: "Xem hồ sơ", exact: true }),
  ).not.toBeVisible();
  await expect(page).toHaveURL(/\/friends$/);
  if (!isMobile) {
    const left = await rows.boundingBox();
    const right = await detail.boundingBox();
    expect(right!.x).toBeGreaterThan(left!.x + left!.width);
    expect(right!.y + right!.height).toBeLessThanOrEqual(
      page.viewportSize()!.height + 120,
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight),
    ).toBeLessThanOrEqual(page.viewportSize()!.height + 121);
  } else {
    await expect(rows).not.toBeVisible();
  }
  await detail
    .getByRole("textbox", { name: "Tin nhắn", exact: true })
    .fill("Hẹn gặp bạn!");
  await detail.getByRole("button", { name: "Gửi", exact: true }).click();
  await expect(detail.getByText("Hẹn gặp bạn!", { exact: true })).toBeVisible();
  const composer = detail.getByRole("textbox", {
    name: "Tin nhắn",
    exact: true,
  });
  await composer.fill("Dòng đầu");
  await composer.press("Shift+Enter");
  await composer.pressSequentially("Dòng tiếp theo");
  await expect(composer).toHaveValue("Dòng đầu\nDòng tiếp theo");
  await expect(
    detail
      .getByRole("region", { name: "Nội dung hội thoại" })
      .getByText("Dòng đầu\nDòng tiếp theo", { exact: true }),
  ).toHaveCount(0);
  await composer.press("Enter");
  await expect(
    detail
      .getByRole("region", { name: "Nội dung hội thoại" })
      .getByText("Dòng đầu\nDòng tiếp theo", { exact: true }),
  ).toBeVisible();
  await expect(composer).toHaveValue("");
  if (isMobile)
    await page.getByRole("button", { name: "Danh sách hội thoại" }).click();
  await rows.getByRole("button", { name: /Hội thoại chuyến đi/ }).click();
  await expect(
    detail.getByText("Điểm đón ở cổng trường", { exact: true }),
  ).toBeVisible();
  await detail.getByLabel("Tùy chọn hội thoại", { exact: true }).click();
  await expect(
    detail.getByRole("link", { name: "Xem đặt chỗ" }),
  ).toHaveAttribute("href", "/bookings/booking-1");
  await page.keyboard.press("Escape");
  await expect(detail.getByText("Chào bạn", { exact: true })).not.toBeVisible();
  await expect(
    detail.getByRole("button", { name: "Gửi", exact: true }),
  ).toBeDisabled();
  if (isMobile)
    await page.getByRole("button", { name: "Danh sách hội thoại" }).click();
  await page.getByRole("button", { name: "Bạn bè", exact: true }).click();
  await expect(safety).not.toBeVisible();
  for (const tab of ["Lời mời đến", "Đã gửi", "Đã chặn"]) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    await expect(safety).toBeVisible();
  }
  await page.getByRole("button", { name: "Tin nhắn", exact: true }).click();
  await expect(page).toHaveURL(/\/friends$/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
