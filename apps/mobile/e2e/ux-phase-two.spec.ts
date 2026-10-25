import { test, expect } from "@playwright/test";
import { setup, post, departure, noOverflow } from "./fixtures";

const response = (id: string, status = "PENDING") => ({
  id,
  postId: "post-1",
  requesterId: "other",
  requesterDisplayName: "Thu Hà",
  requesterAvatarUrl: null,
  ownerId: "member",
  action: "REQUEST_RIDE",
  status,
  message: "",
  createdAt: departure,
  updatedAt: departure,
  version: 0,
  conversationId: null,
});

test("my drafts can be reopened and published with their actual version", async ({
  page,
}) => {
  await setup(page);
  let published = false;
  const draft = {
    ...post,
    id: "draft",
    ownerId: "member",
    status: "DRAFT",
    type: "NEED_RIDE",
    version: 4,
    expiresAt: departure,
  };
  await page.route("**/api/v1/ride-posts?tab=mine**", (r) =>
    r.fulfill({
      json: {
        items: [{ ...draft, status: published ? "OPEN" : "DRAFT" }],
        nextCursor: null,
      },
    }),
  );
  await page.route("**/api/v1/ride-posts/draft", (r) =>
    r.fulfill({ json: { ...draft, status: published ? "OPEN" : "DRAFT" } }),
  );
  await page.route("**/api/v1/ride-posts/draft/publish", async (r) => {
    expect(r.request().postDataJSON()).toEqual({ version: 4 });
    expect(r.request().headers()["idempotency-key"]).toBeTruthy();
    published = true;
    await r.fulfill({ json: { ...draft, status: "OPEN", version: 5 } });
  });
  await page.goto("/trips");
  await page.getByRole("button", { name: "Bản nháp", exact: true }).click();
  await expect(page).toHaveURL(/my-posts\?filter=drafts/);
  await page
    .getByRole("button", { name: "Xem lại bản nháp", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Đăng bản nháp", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Xác nhận đăng bản nháp", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Đăng bản nháp", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Quay lại", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Xem lại bản nháp", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Tất cả", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Quản lý bài đăng", exact: true }),
  ).toBeVisible();
});

test("driver draft opens its source trip and retries with the same key", async ({
  page,
}) => {
  await setup(page);
  let opened = false;
  const keys: string[] = [];
  const draft = {
    ...post,
    id: "driver-draft",
    ownerId: "member",
    status: "DRAFT",
    version: 2,
    expiresAt: departure,
  };
  await page.route("**/api/v1/ride-posts/driver-draft", (r) =>
    r.fulfill({ json: { ...draft, status: opened ? "OPEN" : "DRAFT" } }),
  );
  await page.route(
    "**/api/v1/ride-posts/driver-draft/draft-source?version=2",
    (r) =>
      r.fulfill({ json: { id: "source-trip", version: 7, status: "DRAFT" } }),
  );
  await page.route("**/api/v1/trips/source-trip/open", async (r) => {
    keys.push(r.request().headers()["idempotency-key"]);
    expect(r.request().postDataJSON()).toEqual({ version: 7 });
    if (keys.length === 1)
      return r.fulfill({
        status: 503,
        json: { error: { code: "TEMPORARY", message: "Thử đăng lại" } },
      });
    opened = true;
    await r.fulfill({ json: { id: "source-trip", status: "OPEN" } });
  });
  await page.goto("/posts/driver-draft");
  await page
    .getByRole("button", { name: "Đăng bản nháp", exact: true })
    .click();
  const confirm = page.getByRole("button", {
    name: "Xác nhận đăng bản nháp",
    exact: true,
  });
  await confirm.click();
  await expect(page.getByText("Thử đăng lại", { exact: true })).toBeVisible();
  await confirm.click();
  await expect(confirm).toHaveCount(0);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
});

test("request inbox paginates, separates direction and opens the response context", async ({
  page,
}) => {
  await setup(page);
  await page.route("**/api/v1/ride-post-responses?**", (r) => {
    const url = new URL(r.request().url());
    const sent = url.searchParams.get("direction") === "sent";
    const more = url.searchParams.has("cursor");
    return r.fulfill({
      json: {
        items: [
          {
            ...response(
              more ? "old" : "pending",
              more ? "COMPLETED" : "PENDING",
            ),
            ownerId: sent ? "other" : "member",
            requesterId: sent ? "member" : "other",
            message: sent
              ? "Yêu cầu tôi đã gửi"
              : more
                ? "Yêu cầu cũ"
                : "Đang chờ tôi",
          },
        ],
        nextCursor: more ? null : "pending",
      },
    });
  });
  await page.goto("/requests");
  await expect(page.getByText("Đang chờ tôi", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Tải thêm yêu cầu", exact: true })
    .click();
  await expect(page.getByText("Yêu cầu cũ", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Chờ phản hồi", exact: true }).click();
  await expect(page.getByText("Yêu cầu cũ", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Đã gửi", exact: true }).click();
  await expect(
    page.getByText("Yêu cầu tôi đã gửi", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Xem tiến độ yêu cầu", exact: true })
    .click();
  await expect(page).toHaveURL(/posts\/post-1\?responseId=pending/);
});

test("accepted response stays visible on home without becoming a booking", async ({
  page,
}) => {
  await setup(page);
  await page.route("**/api/v1/ride-post-responses/active", (r) =>
    r.fulfill({ json: [response("accepted", "ACCEPTED")] }),
  );
  await page.goto("/");
  await expect(
    page.getByText("Tiếp tục hành trình đi cùng", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Xem tiến độ yêu cầu", exact: true })
    .click();
  await expect(page).toHaveURL(/posts\/post-1\?responseId=accepted/);
});

test("expired drafts cannot be published", async ({ page }) => {
  await setup(page);
  await page.route("**/api/v1/ride-posts/expired-draft", (r) =>
    r.fulfill({
      json: {
        ...post,
        id: "expired-draft",
        ownerId: "member",
        status: "DRAFT",
        expiresAt: "2000-01-01T00:00:00Z",
      },
    }),
  );
  await page.goto("/posts/expired-draft");
  await expect(
    page.getByRole("button", { name: "Đăng bản nháp", exact: true }),
  ).toBeDisabled();
});

test("request errors recover without losing direction and compact pages do not overflow", async ({
  page,
}) => {
  await setup(page);
  let failed = true;
  await page.route("**/api/v1/ride-post-responses?**", (r) =>
    r.fulfill(
      failed
        ? {
            status: 503,
            json: { error: { message: "Danh sách tạm gián đoạn" } },
          }
        : { json: { items: [response("visible")], nextCursor: null } },
    ),
  );
  await page.goto("/requests");
  await page.getByRole("button", { name: "Đã gửi", exact: true }).click();
  await expect(
    page.getByText("Danh sách tạm gián đoạn", { exact: true }),
  ).toBeVisible();
  failed = false;
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(
    page.getByText("Yêu cầu nhận được", { exact: false }),
  ).toBeVisible();
  for (const width of [360, 430]) {
    await page.setViewportSize({ width, height: 900 });
    await noOverflow(page);
    await page.screenshot({
      path: `../../.tmp/phase-two-requests-${width}.png`,
      fullPage: true,
    });
  }
  await page.route("**/api/v1/ride-posts?tab=mine**", (r) =>
    r.fulfill({
      json: {
        items: [{ ...post, ownerId: "member", status: "DRAFT" }],
        nextCursor: null,
      },
    }),
  );
  await page.goto("/my-posts");
  await expect(
    page.getByRole("button", { name: "Xem lại bản nháp", exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: "../../.tmp/phase-two-my-posts.png",
    fullPage: true,
  });
  await page.goto("/trips");
  await expect(
    page.getByRole("button", { name: "Yêu cầu đi cùng", exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: "../../.tmp/phase-two-trips.png",
    fullPage: true,
  });
});
