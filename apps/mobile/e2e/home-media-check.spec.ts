import { test, expect } from "@playwright/test";
import { setup, post } from "./fixtures";

test("home media fills cards and seeded avatar loads", async ({ page }) => {
  await setup(page);
  await page.route("**/api/v1/ride-posts?**", (r) =>
    r.fulfill({
      json: {
        items: [{ ...post, ownerAvatarUrl: "/images/avatars/rider-1.jpg" }],
        nextCursor: null,
      },
    }),
  );
  await page.goto("/");
  const avatar = page.getByRole("img", {
    name: post.ownerDisplayName,
    exact: true,
  });
  await expect(avatar).toBeVisible();
  await expect
    .poll(() => avatar.evaluate((e) => (e as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  const card = page.getByRole("button", {
    name: "Tôi chở · Đăng chuyến đi chung",
    exact: true,
  });
  const measurements = await card.evaluate((e) => ({
    card: e.getBoundingClientRect().toJSON(),
    images: [...e.querySelectorAll("img")].map((i) =>
      i.getBoundingClientRect().toJSON(),
    ),
  }));
  for (const image of measurements.images) {
    expect(Math.abs(image.width - measurements.card.width)).toBeLessThan(1);
    expect(Math.abs(image.height - measurements.card.height)).toBeLessThan(1);
  }
  await page.screenshot({
    path: "../../.tmp/home-media-fixed.png",
    fullPage: true,
  });
});
