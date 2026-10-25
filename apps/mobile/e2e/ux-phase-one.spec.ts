import { test, expect } from "@playwright/test";
import { setup, post, session } from "./fixtures";

test("feed actions describe the destination for each role and ownership", async ({
  page,
}) => {
  await setup(page);
  await page.route("**/api/v1/ride-posts?**", (r) =>
    r.fulfill({
      json: {
        items: [
          post,
          { ...post, id: "need", type: "NEED_RIDE" },
          { ...post, id: "mine", ownerId: "member" },
          {
            ...post,
            id: "pending",
            ownerId: "member",
            pendingResponseCount: 2,
          },
          { ...post, id: "closed", status: "CLOSED" },
        ],
        nextCursor: null,
      },
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("tab", { name: "Chuyến đi", exact: true }),
  ).toBeVisible();
  for (const label of [
    "Xem chuyến đi",
    "Xem nhu cầu",
    "Quản lý bài",
    "Xem yêu cầu",
    "Xem bài đăng",
  ])
    await expect(page.getByText(label, { exact: true })).toHaveCount(1);
  await page.getByText("Xem nhu cầu", { exact: true }).click();
  await expect(page).toHaveURL(/\/posts\/need$/);
});

test("post report submits the backend POST target contract", async ({
  page,
}) => {
  const captured = await setup(page);
  await page.goto("/posts/post-1");
  await page
    .getByRole("button", { name: "Báo cáo bài đăng", exact: true })
    .click();
  await page.getByRole("button", { name: "Gửi báo cáo", exact: true }).click();
  await expect
    .poll(() => captured.find((r) => r.path === "/reports")?.body)
    .toMatchObject({
      targetType: "POST",
      targetId: "post-1",
      reason: "UNSAFE",
    });
  await expect(
    page.getByText("Báo cáo đã được gửi", { exact: true }),
  ).toBeVisible();
});

for (const evidence of ["NONE", "SIMULATED", "REAL"]) {
  test(`verification explains ${evidence} without exposing enum labels`, async ({
    page,
  }) => {
    await setup(page);
    await page.route("**/api/v1/auth/session", (r) =>
      r.fulfill({
        json: {
          ...session,
          user: {
            ...session.user,
            verificationEvidence: evidence,
            driverApprovalEvidence: evidence,
            accessMode: evidence === "SIMULATED" ? "SIMULATED" : "VERIFIED",
          },
        },
      }),
    );
    await page.goto("/verification");
    const text =
      evidence === "REAL"
        ? "Đã xác minh danh tính"
        : evidence === "SIMULATED"
          ? "Danh tính thử nghiệm · Chưa xác minh thật"
          : "Chưa có bằng chứng xác minh danh tính";
    await expect(page.getByText(text, { exact: true })).toBeVisible();
    await expect(page.getByText(evidence, { exact: true })).toHaveCount(0);
  });
}
