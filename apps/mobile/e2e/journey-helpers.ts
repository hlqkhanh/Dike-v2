import { expect, type Page } from "@playwright/test";

export async function selectRoute(
  page: Page,
  mode: "driver" | "passenger" = "passenger",
) {
  await page.getByRole("button", { name: "Sửa điểm đi", exact: true }).click();
  await page.getByLabel("Điểm đi", { exact: true }).fill("FPT");
  await page.getByRole("button", { name: "Tìm địa điểm", exact: true }).click();
  await page.getByText("FPT", { exact: true }).click();
  await page.getByLabel("Điểm đến", { exact: true }).fill("Quận 1");
  await page.getByRole("button", { name: "Tìm địa điểm", exact: true }).click();
  await page.getByText("Quận 1", { exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: mode === "driver" ? "Xác nhận điểm xuất phát" : "Xác nhận điểm đón",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({ path: `test-results/journey-pickup-${mode}.png` });
  await page
    .getByRole("button", {
      name: mode === "driver" ? "Xác nhận điểm xuất phát" : "Xác nhận điểm đón",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Chuyến đi của bạn", { exact: true }),
  ).toBeVisible();
}

export async function scheduleTrip(page: Page, date: string) {
  await page
    .getByRole("button", { name: "Hẹn giờ khởi hành", exact: true })
    .click();
  await page.getByRole("button", { name: "Hẹn giờ", exact: true }).click();
  await page.getByLabel("Ngày và giờ khởi hành", { exact: true }).fill(date);
  await page
    .getByRole("button", { name: "Xác nhận thời gian", exact: true })
    .click();
}
