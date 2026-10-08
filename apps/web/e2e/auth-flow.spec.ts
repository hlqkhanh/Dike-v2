import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/social/revision", (route) =>
    route.fulfill({ json: { revision: 0 } }),
  );
});

const session = {
  authenticated: true,
  user: {
    id: "user-1",
    displayName: "Người lái thử",
    avatarUrl: null,
    email: "masked@example.test",
    onboardingStatus: "PHONE_REQUIRED",
    phoneStatus: "NOT_PROVIDED",
    phoneMasked: null,
    phoneVersion: 0,
    verificationEvidence: "NONE",
    driverApprovalEvidence: "NONE",
    accessMode: "RESTRICTED",
    authorities: ["MEMBER"],
    authorizationVersion: 0,
    nextAction: "SUBMIT_PHONE",
  },
  session: {
    id: "public-session-1",
    deviceLabel: "Chromium test",
    createdAt: "2026-10-06T00:00:00Z",
    lastSeenAt: "2026-10-06T00:00:00Z",
    idleExpiresAt: "2026-10-07T00:00:00Z",
    absoluteExpiresAt: "2026-11-05T00:00:00Z",
    current: true,
  },
};

test("login entry uses the same-origin backend route", async ({ page }) => {
  await page.goto("/login");

  await expect(
    page.getByRole("link", { name: "Tiếp tục với Google" }),
  ).toHaveAttribute("href", "/api/v1/auth/google");
});

test("auth completion routes a new user through phone onboarding", async ({
  context,
  page,
}) => {
  await context.addCookies([
    { name: "XSRF-TOKEN", value: "csrf-e2e", url: "http://127.0.0.1:3100" },
  ]);
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(session),
    }),
  );
  await page.goto("/auth/complete");
  await expect(page).toHaveURL(/\/onboarding\/phone$/);

  await page.route("**/api/v1/auth/phone", async (route) => {
    expect(route.request().method()).toBe("PUT");
    expect(route.request().headers()["x-xsrf-token"]).toBe("csrf-e2e");
    expect(route.request().postDataJSON()).toEqual({
      phoneNumber: "0901 234 567",
      expectedPhoneVersion: 0,
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...session,
        user: {
          ...session.user,
          onboardingStatus: "PHONE_SUBMITTED",
          phoneStatus: "UNVERIFIED",
          phoneMasked: "+849••••4567",
          phoneVersion: 1,
          verificationEvidence: "SIMULATED",
          driverApprovalEvidence: "SIMULATED",
          accessMode: "SIMULATED",
          authorities: ["MEMBER", "VERIFIED_MEMBER", "APPROVED_DRIVER"],
          authorizationVersion: 1,
          nextAction: "NONE",
        },
      }),
    });
  });
  let otpRequested = false;
  await page.route("**/api/v1/auth/otp", async (route) => {
    otpRequested = true;
    await route.abort();
  });
  await page.route("**/api/v1/ride-posts**", (route) =>
    route.fulfill({ json: { items: [] } }),
  );
  await page.route("**/api/v1/ride-capabilities", (route) =>
    route.fulfill({
      json: {
        posting: true,
        trips: true,
        proposals: true,
        canCreateTrip: true,
        canManageBookings: true,
        accessMode: "SIMULATED",
        vehicles: [],
        message: "Sẵn sàng",
      },
    }),
  );
  await page.getByLabel("Số điện thoại Việt Nam").fill("0901 234 567");
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3100/feed");
  expect(otpRequested).toBe(false);
});

test("consent gate records current receipts before onboarding", async ({
  context,
  page,
}) => {
  let accepted = false;
  await context.addCookies([
    { name: "XSRF-TOKEN", value: "csrf-e2e", url: "http://127.0.0.1:3100" },
  ]);
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...session,
        user: {
          ...session.user,
          nextAction: accepted ? "SUBMIT_PHONE" : "REVIEW_CONSENT",
        },
      }),
    }),
  );
  await page.route("**/api/v1/me/consents", async (route) => {
    if (route.request().method() === "POST") {
      expect(route.request().headers()["x-xsrf-token"]).toBe("csrf-e2e");
      accepted = true;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "receipt-1",
          type: route.request().postDataJSON().consentType,
          version: "2026-10-06",
          decision: "ACCEPTED",
          occurredAt: "2026-10-06T00:00:00Z",
          source: "WEB",
          locale: "vi",
        }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        requirements: [
          {
            type: "TERMS",
            version: "2026-10-06",
            documentUrl: "/legal/terms",
            accepted,
          },
        ],
        receipts: accepted
          ? [
              {
                id: "receipt-1",
                type: "TERMS",
                version: "2026-10-06",
                decision: "ACCEPTED",
                occurredAt: "2026-10-06T00:00:00Z",
                source: "WEB",
                locale: "vi",
              },
            ]
          : [],
      }),
    });
  });

  await page.goto("/auth/complete");
  await expect(page).toHaveURL(/\/settings\/consent\?flow=onboarding$/);
  await page.getByRole("button", { name: "Tôi đồng ý" }).click();
  await expect(page).toHaveURL(/\/onboarding\/phone$/);
});

test("member edits profile and privacy through generated-client adapters", async ({
  context,
  page,
}) => {
  await context.addCookies([
    { name: "XSRF-TOKEN", value: "csrf-e2e", url: "http://127.0.0.1:3100" },
  ]);
  let profile = {
    userId: "user-1",
    displayName: "Người lái thử",
    bio: "",
    version: 0,
    updatedAt: "2026-10-06T00:00:00Z",
  };
  await page.route("**/api/v1/me/profile", async (route) => {
    if (route.request().method() === "PATCH") {
      expect(route.request().headers()["x-xsrf-token"]).toBe("csrf-e2e");
      profile = { ...profile, ...route.request().postDataJSON(), version: 1 };
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(profile),
    });
  });
  await page.route("**/api/v1/me/privacy", async (route) => {
    const body =
      route.request().method() === "PATCH"
        ? route.request().postDataJSON()
        : {};
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        profileVisibility: body.profileVisibility ?? "MEMBERS",
        discoverableByName: body.discoverableByName ?? true,
        allowMessageRequests: body.allowMessageRequests ?? true,
        version: route.request().method() === "PATCH" ? 1 : 0,
        updatedAt: "2026-10-06T00:00:00Z",
      }),
    });
  });

  await page.goto("/me/profile");
  await page.getByLabel("Tên hiển thị").fill("Nguyễn An");
  await page.getByLabel("Giới thiệu").fill("Đi cùng tuyến mỗi ngày.");
  await page.getByRole("button", { name: "Lưu hồ sơ" }).click();
  await expect(page.getByLabel("Tên hiển thị")).toHaveValue("Nguyễn An");

  await page.goto("/settings/privacy");
  await page.getByLabel("Ai có thể xem hồ sơ cơ bản").selectOption("PRIVATE");
  await page.getByRole("button", { name: "Lưu quyền riêng tư" }).click();
  await expect(page.getByLabel("Ai có thể xem hồ sơ cơ bản")).toHaveValue(
    "PRIVATE",
  );
});

test("session management revokes only the selected public handle", async ({
  page,
}) => {
  const revoked: string[] = [];
  await page.route("**/api/v1/auth/sessions**", async (route) => {
    if (route.request().method() === "DELETE") {
      revoked.push(route.request().url().split("/").at(-1) ?? "");
      await route.fulfill({ status: 204 });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sessions: [
          session.session,
          {
            ...session.session,
            id: "public-session-2",
            deviceLabel: "Điện thoại",
            current: false,
          },
        ],
      }),
    });
  });

  await page.goto("/account/sessions");
  await expect(page.getByText("Chromium test")).toBeVisible();
  await expect(page.getByText("Điện thoại")).toBeVisible();
  await page.getByRole("button", { name: "Đăng xuất thiết bị" }).last().click();
  await expect.poll(() => revoked).toEqual(["public-session-2"]);
});
