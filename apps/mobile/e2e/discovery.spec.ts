import { selectRoute, scheduleTrip } from "./journey-helpers";
import { expect, test, type Page } from "@playwright/test";
import { noOverflow, setup, type Captured } from "./fixtures";

async function prepareSearch(page: Page) {
  await page.goto("/create-trip?mode=passenger");
  await expect(
    page.getByText("Bạn muốn đi đâu?", { exact: true }),
  ).toBeVisible();
  await selectRoute(page);
  await page.screenshot({ path: "test-results/create-trip-details.png" });
  const tomorrow = new Date(Date.now() + 86_400_000);
  const date = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")} 10:00`;
  await scheduleTrip(page, date);
  await page
    .getByRole("button", { name: "Tìm chuyến phù hợp", exact: true })
    .click();
  await page.screenshot({ path: "test-results/create-trip-step-3.png" });
  return date;
}

test("discovery sends a ride request without publishing the passenger draft", async ({
  page,
}) => {
  const captured: Captured[] = await setup(page);
  await prepareSearch(page);

  await expect(page.getByText("Thu Hà", { exact: true })).toBeVisible();
  await expect(page.getByText(/350 m/)).toBeVisible();
  await page
    .getByRole("button", { name: "Yêu cầu đi ké", exact: true })
    .click();
  await expect(
    page.getByText("Bài đang soạn của bạn sẽ chưa được đăng.", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByLabel("Lời nhắn (không bắt buộc)")
    .fill("Cho mình đi cùng nhé");
  await page.getByRole("button", { name: "Gửi yêu cầu", exact: true }).click();

  await expect(page.getByText(/Đã gửi yêu cầu.*chưa được đăng/)).toBeVisible();
  expect(
    captured.filter(
      (request) =>
        request.path === "/ride-posts/post-1/pickup-checks" &&
        request.method === "POST",
    ),
  ).toHaveLength(1);
  expect(
    captured.filter(
      (request) =>
        request.path === "/ride-posts/post-1/responses" &&
        request.method === "POST",
    ),
  ).toHaveLength(1);
  expect(
    captured.filter(
      (request) => request.path === "/ride-posts" && request.method === "POST",
    ),
  ).toHaveLength(0);
  await noOverflow(page);
});

test("empty discovery keeps the entered route and offers publishing as recovery", async ({
  page,
}) => {
  await setup(page, { discoveryEmpty: true });
  const date = await prepareSearch(page);

  await expect(
    page.getByText("Chưa tìm thấy người phù hợp", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Chỉnh sửa thông tin", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Hẹn giờ khởi hành", exact: true })
    .click();
  await expect(
    page.getByLabel("Ngày và giờ khởi hành", { exact: true }),
  ).toHaveValue(date);
  await page
    .getByRole("button", { name: "Xác nhận thời gian", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Sửa tuyến đường", exact: true }),
  ).toContainText("Đại học FPT");
});

test("failed discovery can retry without losing the composed trip", async ({
  page,
}) => {
  await setup(page, { failDiscovery: true });
  const date = await prepareSearch(page);

  await expect(
    page.getByRole("button", { name: "Thử tìm lại", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Chỉnh sửa thông tin", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Hẹn giờ khởi hành", exact: true })
    .click();
  await expect(
    page.getByLabel("Ngày và giờ khởi hành", { exact: true }),
  ).toHaveValue(date);
  await page
    .getByRole("button", { name: "Xác nhận thời gian", exact: true })
    .click();
});
