import { expect, test } from "@playwright/test";
import type { JourneyMessage } from "@dike/api-client-ts";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/realtime/tickets", (route) =>
    route.fulfill({
      status: 503,
      json: { error: { code: "REALTIME_UNAVAILABLE" } },
    }),
  );
});

for (const withText of [true, false]) {
  test(`exchange prepares a draft and sends ${withText ? "with text" : "attachment only"} after confirmation`, async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await context.addCookies([
      { name: "XSRF-TOKEN", value: "csrf-discussion", url: baseURL! },
    ]);
    await page.route("**/api/v1/auth/session", (route) =>
      route.fulfill({
        json: {
          authenticated: true,
          user: { id: "viewer", displayName: "Khách thử nghiệm" },
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
    await page.route("**/api/v1/notifications", (route) =>
      route.fulfill({ json: [] }),
    );
    const postId = "demo:owner:post-offer";
    const ridePost = {
      postId,
      type: "OFFER_RIDE" as const,
      originLabel: "Hà Đông, Hà Nội",
      destinationLabel: "Nam Từ Liêm, Hà Nội",
      departureAt: "2026-10-14T09:00:00Z",
      vehicleType: "CAR",
      remainingSeats: 2,
      contributionPerKm: 1000,
    };
    await page.route(
      `**/api/v1/ride-posts/${encodeURIComponent(postId)}`,
      (route) =>
        route.fulfill({
          json: {
            ...ridePost,
            id: postId,
            ownerId: "owner",
            ownerDisplayName: "Linh Nguyễn",
            status: "OPEN",
            visibility: "PUBLIC",
            version: 1,
            termsVersion: 1,
            expiresAt: "2026-10-15T09:00:00Z",
            note: "Đi cùng",
          },
        }),
    );
    await page.route("**/api/v1/ride-posts/*/responses", (route) =>
      route.fulfill({ json: [] }),
    );
    const conversation = {
      id: "owner-chat",
      type: "DIRECT",
      state: "REQUEST_PENDING",
      participantIds: ["viewer", "owner"],
      recipientDisplayName: "Linh Nguyễn",
      canSend: true,
      unreadCount: 0,
      version: 1,
    };
    const messages: JourneyMessage[] = [];
    let discussCalls = 0;
    await page.route("**/api/v1/conversations/ride-post", (route) => {
      const body = route.request().postDataJSON();
      expect(body.postId).toBe(postId);
      expect(body.clientMessageId).toBeUndefined();
      expect(route.request().headers()["x-xsrf-token"]).toBe("csrf-discussion");
      discussCalls++;
      return route.fulfill({ json: conversation });
    });
    await page.route("**/api/v1/conversations", (route) =>
      route.fulfill({
        json: [
          {
            ...conversation,
            id: "unrelated-chat",
            recipientDisplayName: "Người khác",
          },
          ...(withText ? [conversation] : []),
        ],
      }),
    );
    await page.route("**/api/v1/conversations/owner-chat", (route) =>
      route.fulfill({ json: conversation }),
    );
    await page.route("**/api/v1/conversations/owner-chat/messages", (route) => {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON();
        const message: JourneyMessage = {
          id: "follow-up",
          conversationId: conversation.id,
          senderId: "viewer",
          clientMessageId: body.clientMessageId,
          sequence: messages.length + 1,
          text: body.text,
          createdAt: "2026-10-14T08:01:00Z",
          hidden: false,
          ...(body.postId ? { ridePost } : {}),
        };
        messages.push(message);
        return route.fulfill({ json: message });
      }
      return route.fulfill({ json: messages });
    });
    await page.route("**/api/v1/conversations/owner-chat/read", (route) =>
      route.fulfill({ status: 204 }),
    );
    await page.goto(`/feed/${encodeURIComponent(postId)}`);
    await page.getByRole("button", { name: "Trao đổi", exact: true }).click();
    await expect(page).toHaveURL(/\/friends\?conversation=owner-chat&post=/);
    const detail = page.getByRole("region", {
      name: "Chi tiết hội thoại",
      exact: true,
    });
    await expect(
      detail.getByRole("heading", { name: "Linh Nguyễn", exact: true }),
    ).toBeVisible();
    const card = detail.locator(".message-ride-card");
    const draft = detail.getByLabel("Bài đăng đính kèm chưa gửi");
    await expect(draft).toBeVisible();
    await expect(draft).toContainText("Hà Đông, Hà Nội");
    await expect(draft).toContainText("Nam Từ Liêm, Hà Nội");
    await expect(card).toHaveCount(0);
    expect(messages).toHaveLength(0);
    const draftUrl = page.url();
    const input = detail.getByRole("textbox", {
      name: "Tin nhắn",
      exact: true,
    });
    await input.fill("Nội dung đang soạn");
    await detail.getByRole("button", { name: "Bỏ đính kèm bài đăng" }).click();
    await expect(draft).toHaveCount(0);
    await expect(input).toHaveValue("Nội dung đang soạn");
    expect(messages).toHaveLength(0);
    await page.goto(draftUrl);
    await expect(draft).toBeVisible();
    if (!isMobile && withText) {
      await expect(
        page.locator(".inbox-conversation[aria-pressed=true]"),
      ).toContainText("Linh Nguyễn");
    }
    if (withText) {
      await detail
        .getByRole("textbox", { name: "Tin nhắn", exact: true })
        .fill("Mình muốn hỏi thêm điểm đón.");
      await detail
        .getByRole("textbox", { name: "Tin nhắn", exact: true })
        .press("Enter");
      await expect(
        detail.getByText("Mình muốn hỏi thêm điểm đón.", { exact: true }),
      ).toBeVisible();
    } else {
      await detail.getByRole("button", { name: "Gửi", exact: true }).click();
    }
    await expect(draft).toHaveCount(0);
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute(
      "href",
      `/feed/${encodeURIComponent(postId)}`,
    );
    expect(messages).toHaveLength(1);
    await expect(page).toHaveURL(/\/friends\?conversation=owner-chat$/);
    await page.reload();
    await expect(card).toBeVisible();
    await expect(draft).toHaveCount(0);
    if (withText)
      await expect(
        detail.getByText("Mình muốn hỏi thêm điểm đón.", { exact: true }),
      ).toBeVisible();
    expect(discussCalls).toBe(1);
  });
}
