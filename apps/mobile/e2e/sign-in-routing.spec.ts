import { test, expect } from "@playwright/test";
import { setup } from "./fixtures";

for (const nextAction of [
  "REVIEW_CONSENT",
  "SUBMIT_PHONE",
  "VERIFY_PHONE",
  "NONE",
]) {
  test(`sign-in opens the required screen for ${nextAction}`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await setup(page, { authenticated: false, nextAction });
    await page.route("**/auth/dev/mobile?**", (route) =>
      route.fulfill({
        json: { token: "test-session-000000000000000000000000" },
      }),
    );
    await page.goto("/sign-in");
    await page
      .getByRole("button", { name: "Local: member", exact: true })
      .click();
    if (nextAction === "REVIEW_CONSENT") {
      await expect(page).toHaveURL(/\/settings\/consent$/);
      await expect(
        page.getByText("Điều khoản và đồng ý", { exact: true }),
      ).toBeVisible();
    } else if (nextAction === "NONE") {
      await expect(
        page.getByRole("tab", { name: "Trang chủ", exact: true }),
      ).toBeVisible();
    } else {
      await expect(page).toHaveURL(/\/onboarding\/phone$/);
      await expect(
        page.getByText("Xác minh điện thoại", { exact: true }),
      ).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
}
