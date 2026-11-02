import { test, expect } from "@playwright/test";
import { setup, post } from "./fixtures";

test("other posts show a two-place request form and validate before sending", async ({
  page,
}) => {
  const captured = await setup(page);
  await page.goto("/posts/post-1");
  const header = page.getByTestId("post-floating-header");
  await expect(header).toContainText(post.ownerDisplayName);
  await expect(
    header.getByRole("button", { name: "Yêu cầu ngay", exact: true }),
  ).toHaveCount(0);
  const composer = page.getByTestId("post-request-composer");
  await expect(composer).toBeVisible();
  const send = composer.getByRole("button", {
    name: "Gửi yêu cầu",
    exact: true,
  });
  await composer.getByLabel("Điểm đi", { exact: true }).fill("FPT Campus");
  await expect(send).toBeDisabled();
  await composer.getByRole("button", { name: /FPT Campus/ }).click();
  await composer
    .getByLabel("Điểm đến", { exact: true })
    .fill("Central Station");
  await composer.getByRole("button", { name: /Central Station/ }).click();
  await expect(send).toBeEnabled();
  await expect(composer.getByLabel("Lời nhắn", { exact: true })).toHaveCount(0);
  await composer
    .getByRole("button", { name: "Thêm lời nhắn", exact: true })
    .click();
  await expect(composer.getByLabel("Lời nhắn", { exact: true })).toBeFocused();
  await expect(composer.getByText("Lời nhắn", { exact: true })).toHaveCount(0);
  await composer.getByLabel("Lời nhắn", { exact: true }).fill("Meet at gate A");
  await expect(send.getByText("Gửi yêu cầu", { exact: true })).toHaveCSS(
    "color",
    "rgb(255, 255, 255)",
  );
  await send.click();
  await expect
    .poll(() =>
      captured.filter(
        (r) => r.path.endsWith("/responses") && r.method === "POST",
      ),
    )
    .toHaveLength(1);
  expect(
    captured.filter((r) => r.path.endsWith("/pickup-checks")).at(-1)?.body,
  ).toMatchObject({
    pickupPlaceRef: "origin-ref",
    dropoffPlaceRef: "dest-ref",
    useDriverPickup: false,
    useDriverDropoff: false,
  });
  expect(
    captured.find((r) => r.path.endsWith("/responses") && r.method === "POST")
      ?.body,
  ).toMatchObject({ pickupCheckId: "pickup-1", message: "Meet at gate A" });
});

test("incompatible request places never create a response", async ({
  page,
}) => {
  const captured = await setup(page);
  await page.route("**/api/v1/ride-posts/post-1/pickup-checks", (route) =>
    route.fulfill({
      json: { id: "bad", compatible: false, reason: "Outside the route" },
    }),
  );
  await page.goto("/posts/post-1");
  const composer = page.getByTestId("post-request-composer");
  await composer
    .getByRole("button", { name: "Gửi yêu cầu", exact: true })
    .click();
  await expect(composer.getByText("Outside the route").first()).toBeVisible();
  expect(
    captured.filter(
      (r) => r.path.endsWith("/responses") && r.method === "POST",
    ),
  ).toHaveLength(0);
});

test("owners retain post management instead of a self-request form", async ({
  page,
}) => {
  await setup(page);
  await page.route("**/api/v1/ride-posts/post-1", (route) =>
    route.fulfill({ json: { ...post, ownerId: "member" } }),
  );
  await page.goto("/posts/post-1");
  await expect(page.getByTestId("post-journey-summary")).toBeVisible();
  await expect(page.getByTestId("post-request-composer")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Đóng bài đăng", exact: true }),
  ).toHaveCount(0);
  await page
    .getByTestId("post-floating-header")
    .getByRole("button", { name: "Mở tùy chọn bài đăng", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Đóng bài đăng", exact: true }),
  ).toBeEnabled();
});

test("request links show both place inputs immediately", async ({ page }) => {
  await setup(page);
  await page.goto("/posts/post-1?action=request");
  const composer = page.getByTestId("post-request-composer");
  await expect(composer.getByLabel("Điểm đi", { exact: true })).toBeVisible();
  await expect(composer.getByLabel("Điểm đến", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("requests are attached to the post and show only changed places, detour badges and estimated price", async ({
  page,
}) => {
  await setup(page);
  const owned = { ...post, ownerId: "member" };
  await page.route("**/api/v1/ride-posts/post-1", (route) =>
    route.fulfill({ json: owned }),
  );
  const baseCheck = {
    pickup: { displayLabel: post.originLabel },
    dropoff: { displayLabel: post.destinationLabel },
    destinationLabel: post.destinationLabel,
    extraMeters: 0,
    extraSeconds: 0,
    pickupAt: post.departureAt,
  };
  const response = {
    postId: "post-1",
    requesterId: "other",
    requesterDisplayName: "Test rider",
    status: "PENDING",
    message: "Ready at the pickup point",
    createdAt: post.departureAt,
    pickupCheck: baseCheck,
  };
  await page.route("**/api/v1/ride-posts/post-1/responses", (route) =>
    route.fulfill({
      json: [
        {
          ...response,
          id: "same",
          requestSummary: {
            pickupChanged: false,
            dropoffChanged: false,
            extraMeters: 0,
            extraSeconds: 0,
            estimatedAmountVnd: 12000,
          },
        },
        {
          ...response,
          id: "custom",
          pickupCheck: {
            ...baseCheck,
            pickup: { displayLabel: "Coffee shop, 7 Main Street, Quy Nhon" },
          },
          requestSummary: {
            pickupChanged: true,
            dropoffChanged: false,
            extraMeters: 500,
            extraSeconds: 200,
            estimatedAmountVnd: 15000,
          },
        },
      ],
    }),
  );
  await page.goto("/posts/post-1");
  await page
    .getByRole("button", { name: "Thay đổi độ mở bảng chọn", exact: true })
    .click();
  const same = page.getByTestId("request-comment-same");
  await expect(same).toBeVisible();
  await expect(same.getByTestId("request-pickup")).toHaveCount(0);
  await expect(same.getByTestId("request-dropoff")).toHaveCount(0);
  await expect(same.getByText(/12\.000/)).toBeVisible();
  const custom = page.getByTestId("request-comment-custom");
  await expect(custom.getByTestId("request-pickup")).toContainText(
    "Coffee shop",
  );
  await expect(custom.getByTestId("request-dropoff")).toHaveCount(0);
  await expect(custom.getByText("+0,5 km", { exact: true })).toBeVisible();
  await expect(custom.getByText("+4 phút", { exact: true })).toBeVisible();
  await expect(custom.getByText(/15\.000/)).toBeVisible();
  await expect(
    page
      .getByTestId("post-floating-header")
      .getByTestId("post-journey-summary"),
  ).toBeVisible();
  await expect(
    page.getByTestId("post-detail-sheet").getByTestId("post-journey-summary"),
  ).toHaveCount(0);
  await expect(
    custom.getByRole("button", { name: "Chấp nhận", exact: true }),
  ).toHaveCount(0);
  await page.getByTestId("select-request-custom").click();
  await expect(page.getByTestId("request-decision-bar")).toBeVisible();
  await page
    .getByTestId("request-decision-bar")
    .getByRole("button", { name: "Chấp nhận", exact: true })
    .click();
  await expect(page.getByText(/ACCEPTED/)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Xác nhận", exact: true }),
  ).toBeVisible();
});

test("non-owners only see their own requests and withdrawal removes the card permanently", async ({
  page,
}) => {
  await setup(page);
  const mine = {
    id: "mine",
    postId: "post-1",
    ownerId: "other",
    requesterId: "member",
    requesterDisplayName: "My request",
    status: "PENDING",
    message: "Only my message",
    version: 1,
    createdAt: post.departureAt,
  };
  const stranger = {
    ...mine,
    id: "stranger",
    requesterId: "someone-else",
    requesterDisplayName: "PRIVATE USER",
    message: "PRIVATE MESSAGE",
  };
  await page.route("**/api/v1/ride-posts/post-1/responses", (route) =>
    route.fulfill({
      json: [
        mine,
        stranger,
        { ...mine, id: "already-withdrawn", status: "WITHDRAWN" },
      ],
    }),
  );
  await page.route("**/api/v1/ride-post-responses/mine/decision", (route) => {
    mine.status = "WITHDRAWN";
    return route.fulfill({ json: mine });
  });
  await page.goto("/posts/post-1");
  await page
    .getByRole("button", { name: "Thay đổi độ mở bảng chọn", exact: true })
    .click();
  await expect(page.getByTestId("request-comment-mine")).toBeVisible();
  await expect(page.getByTestId("post-request-composer")).toHaveCount(0);
  const sentCard = page.getByTestId("request-comment-mine");
  await expect(
    sentCard.getByText("Yêu cầu của bạn", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Yêu cầu của bạn", { exact: true })).toHaveCount(
    1,
  );
  await expect(sentCard.getByText("My request", { exact: true })).toHaveCount(
    0,
  );
  await expect(sentCard.getByText("Only my message")).toBeVisible();
  await expect(
    sentCard.getByRole("button", { name: "Mở trò chuyện", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("request-comment-stranger")).toHaveCount(0);
  await expect(
    page.getByTestId("request-comment-already-withdrawn"),
  ).toHaveCount(0);
  await expect(page.getByText("PRIVATE MESSAGE")).toHaveCount(0);
  await page
    .getByTestId("request-comment-mine")
    .getByRole("button", { name: "Rút yêu cầu", exact: true })
    .click();
  await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(page.getByTestId("request-comment-mine")).toHaveCount(0);
  await expect(
    page
      .getByTestId("post-request-composer")
      .getByLabel("Điểm đi", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("post-journey-summary")).toBeVisible();
  await expect(page.getByTestId("request-comment-mine")).toHaveCount(0);
  await expect(page.getByTestId("request-comment-stranger")).toHaveCount(0);
});

test("request sheet fits its content and collapsing dismisses the focused message", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/posts/post-1");
  const composer = page.getByTestId("post-request-composer");
  await composer
    .getByRole("button", { name: "Thêm lời nhắn", exact: true })
    .click();
  const message = composer.getByLabel("Lời nhắn", { exact: true });
  await expect(message).toBeFocused();
  const sheet = page.getByTestId("post-detail-sheet");
  await expect(sheet).toHaveAttribute("aria-expanded", "true");
  const send = composer.getByRole("button", {
    name: "Gửi yêu cầu",
    exact: true,
  });
  await expect
    .poll(async () => {
      const panel = await sheet.boundingBox();
      const button = await send.boundingBox();
      return Math.abs(panel.y + panel.height - button.y - button.height);
    })
    .toBeLessThanOrEqual(24);
  await page
    .getByRole("button", { name: "Thay đổi độ mở bảng chọn", exact: true })
    .click();
  await expect(sheet).toHaveAttribute("aria-expanded", "false");
  await expect(message).not.toBeFocused();
});

test("sheet follows upward and downward drags beyond its content height", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/posts/post-1");
  const sheet = page.getByTestId("post-detail-sheet");
  const handle = sheet.getByRole("button").first();
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(400);
  const before = await sheet.boundingBox();
  const grip = await handle.boundingBox();
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2, grip.y - 300, { steps: 24 });
  const during = await sheet.boundingBox();
  expect(during.height).toBeGreaterThan(before.height + 150);
  await page.mouse.up();
  await expect(sheet).toHaveAttribute("aria-expanded", "true");
  await page.waitForTimeout(500);
  const expanded = await sheet.boundingBox();
  const newGrip = await handle.boundingBox();
  await page.mouse.move(
    newGrip.x + newGrip.width / 2,
    newGrip.y + newGrip.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(newGrip.x + newGrip.width / 2, newGrip.y + 360, {
    steps: 24,
  });
  expect((await sheet.boundingBox()).height).toBeLessThan(
    expanded.height - 200,
  );
  await page.mouse.up();
  await expect(sheet).toHaveAttribute("aria-expanded", "false");
});
