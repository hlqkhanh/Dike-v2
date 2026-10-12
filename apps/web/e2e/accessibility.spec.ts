import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function expectNoSeriousViolations(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  const serious = result.violations.filter((violation) =>
    ["critical", "serious"].includes(violation.impact ?? ""),
  );
  expect(
    serious,
    serious.map((violation) => `${violation.id}: ${violation.help}`).join("\n"),
  ).toEqual([]);
}

test("public and offline shells have no serious accessibility violations", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill({
      status: 401,
      json: { error: { code: "AUTHENTICATION_REQUIRED" } },
    }),
  );
  await page.goto("/login");
  await expectNoSeriousViolations(page);
  await page.goto("/offline");
  await expectNoSeriousViolations(page);
});

test("simulated verification status is accessible", async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill({
      json: {
        authenticated: true,
        user: {
          id: "synthetic-user",
          displayName: "Tài xế thử nghiệm",
          email: "synthetic@example.test",
          onboardingStatus: "PHONE_SUBMITTED",
          phoneStatus: "UNVERIFIED",
          phoneMasked: "+849••••567",
          phoneVersion: 1,
          verificationEvidence: "SIMULATED",
          driverApprovalEvidence: "SIMULATED",
          accessMode: "SIMULATED",
          authorities: ["MEMBER", "VERIFIED_MEMBER", "APPROVED_DRIVER"],
          authorizationVersion: 1,
          nextAction: "NONE",
        },
        session: {
          id: "synthetic-session",
          deviceLabel: "Playwright",
          createdAt: "2026-10-08T00:00:00Z",
          lastSeenAt: "2026-10-08T00:00:00Z",
          idleExpiresAt: "2026-10-09T00:00:00Z",
          absoluteExpiresAt: "2026-11-07T00:00:00Z",
          current: true,
        },
      },
    }),
  );
  await page.route("**/api/v1/realtime/tickets", (route) =>
    route.fulfill({
      status: 503,
      json: { error: { code: "REALTIME_TEMPORARILY_UNAVAILABLE" } },
    }),
  );
  await page.route("**/api/v1/social/revision", (route) =>
    route.fulfill({ json: { revision: 1 } }),
  );
  await page.route("**/api/v1/notifications", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.goto("/verification");
  await expect(
    page.getByRole("main").getByText("Tài xế thử nghiệm", { exact: true }),
  ).toBeVisible();
  await expectNoSeriousViolations(page);
  expect(pageErrors).toEqual([]);
});
