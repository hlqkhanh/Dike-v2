import { expect, test } from "@playwright/test";

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

const relation = {
  userId: "other",
  displayName: "Bạn thử nghiệm",
  status: "INCOMING",
  requestId: "invitation-1",
  cooldownUntil: null,
  blockedByMe: false,
  version: 1,
  allowedActions: ["ACCEPT", "DECLINE", "BLOCK"],
};

test("accept invitation, revoke friendship, and manage own block", async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: "XSRF-TOKEN", value: "csrf-social", url: "http://127.0.0.1:3100" },
  ]);
  let current = { ...relation };
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
    route.fulfill({ json: { revision: current.version } }),
  );
  await page.route("**/api/v1/conversations", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route("**/api/v1/friendships**", async (route) => {
    const request = route.request();
    if (request.method() !== "GET") {
      expect(request.headers()["x-xsrf-token"]).toBe("csrf-social");
      expect(request.headers()["idempotency-key"]).toBeTruthy();
      if (request.url().endsWith("/accept"))
        current = {
          ...current,
          status: "ACCEPTED",
          version: 2,
          allowedActions: ["REMOVE", "BLOCK"],
        };
      else if (request.method() === "DELETE")
        current = {
          ...current,
          status: "REMOVED",
          version: 3,
          allowedActions: ["BLOCK"],
        };
      return route.fulfill({ json: current });
    }
    const isIncoming = request.url().includes("direction=incoming");
    return route.fulfill({
      json: {
        items:
          current.status === (isIncoming ? "INCOMING" : "ACCEPTED")
            ? [current]
            : [],
        nextCursor: null,
      },
    });
  });
  await page.route("**/api/v1/blocks**", async (route) => {
    if (route.request().method() === "DELETE")
      current = {
        ...current,
        blockedByMe: false,
        version: 5,
        allowedActions: [],
      };
    return route.fulfill({
      json:
        route.request().method() === "GET"
          ? { items: current.blockedByMe ? [current] : [], nextCursor: null }
          : current,
    });
  });
  await page.goto("/friends");
  await expect(
    page.getByRole("heading", { name: "Bạn bè", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Tin nhắn", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByText("Chưa có cuộc trò chuyện", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Điều hướng chính" })
      .getByRole("link", { name: "Bạn bè", exact: true }),
  ).toHaveAttribute("href", "/friends");
  await page.getByRole("button", { name: "Lời mời đến", exact: true }).click();
  await expect(page.getByText("Bạn thử nghiệm", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Chấp nhận", exact: true }).click();
  await page.getByRole("button", { name: "Bạn bè", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Hủy kết bạn", exact: true }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Hủy kết bạn", exact: true }).click();
  await expect(page.getByText("Chưa có mục nào trong bạn bè.")).toBeVisible();
  current = {
    ...current,
    blockedByMe: true,
    status: "BLOCKED",
    version: 4,
    allowedActions: ["UNBLOCK"],
  };
  await page.getByRole("button", { name: "Đã chặn", exact: true }).click();
  await expect(
    page.getByText("Bỏ chặn không tự khôi phục bạn bè."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Bỏ chặn", exact: true }).click();
  await expect(page.getByText("Chưa có mục nào trong đã chặn.")).toBeVisible();
  await page.getByRole("button", { name: "Tin nhắn", exact: true }).click();
  await expect(
    page.getByText("Chưa có cuộc trò chuyện", { exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/friends$/);
});

test("remote revision removes a profile already on screen", async ({
  page,
}) => {
  let revoked = false;
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
    route.fulfill({ json: { revision: revoked ? 2 : 1 } }),
  );
  await page.route("**/api/v1/friendships/users/other", (route) =>
    route.fulfill({
      status: 404,
      json: { error: { message: "Không tìm thấy nội dung" } },
    }),
  );
  await page.route("**/api/v1/users/other", (route) =>
    route.fulfill(
      revoked
        ? { status: 404, json: { error: { message: "Không tìm thấy hồ sơ" } } }
        : {
            json: {
              userId: "other",
              displayName: "Hồ sơ được chia sẻ",
              bio: "Nội dung cần thu hồi",
              verified: false,
            },
          },
    ),
  );
  await page.goto("/users/other");
  await expect(page.getByText("Nội dung cần thu hồi")).toBeVisible();
  revoked = true;
  await expect(page.getByText("Nội dung cần thu hồi")).not.toBeVisible({
    timeout: 12_000,
  });
  await expect(
    page.getByRole("heading", { name: "Không tìm thấy hồ sơ" }),
  ).toBeVisible();
});
