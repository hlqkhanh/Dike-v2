import { expect, test } from "@playwright/test";
import { readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { requiresAuthentication } from "../src/auth/route-access";

function pageRoutes(directory: string, root = directory): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return pageRoutes(path, root);
    if (entry.name !== "page.tsx") return [];
    const parts = relative(root, directory)
      .split(sep)
      .filter(Boolean)
      .filter((part) => !part.startsWith("("))
      .map((part) => (part.startsWith("[") ? "test-id" : part));
    return ["/" + parts.join("/")];
  });
}

const protectedRoutes = pageRoutes(resolve(process.cwd(), "app")).filter(
  requiresAuthentication,
);
const guestError = {
  error: { code: "UNAUTHENTICATED", message: "Authentication required" },
};

test("every protected page redirects guests to landing before protected API calls", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(180_000);
  const privateRequests: string[] = [];
  let sessionRequests = 0;
  await page.route("**/api/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/auth/session") sessionRequests++;
    else privateRequests.push(path);
    return route.fulfill({ status: 401, json: guestError });
  });
  const routes = [
    ...protectedRoutes,
    "/home?preview=true",
    "/friends?conversation=test-id&post=test-post",
  ];
  for (const route of routes) {
    const sessionBefore = sessionRequests;
    await page.goto(route);
    await expect(page, `Guest route ${route}`).toHaveURL(
      new URL("/", baseURL).toString(),
    );
    expect(privateRequests, `Protected APIs must not run on ${route}`).toEqual(
      [],
    );
    expect(
      sessionRequests - sessionBefore,
      `No 401 request loop on ${route}`,
    ).toBeLessThanOrEqual(2);
  }
});

test("public pages stay accessible without authentication", async ({
  page,
  baseURL,
}) => {
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill({ status: 401, json: guestError }),
  );
  for (const path of ["/", "/login", "/offline"]) {
    await page.goto(path);
    await expect(page).toHaveURL(new URL(path, baseURL).toString());
  }
});

test("an explicit anonymous session redirects without a landing/home loop", async ({
  page,
  baseURL,
}) => {
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill({
      json: { authenticated: false, user: null, session: null },
    }),
  );
  await page.goto("/friends");
  await expect(page).toHaveURL(new URL("/", baseURL).toString());
  await expect(page.locator(".friends-redesign-page")).toHaveCount(0);
});

test("expired sessions on any protected query redirect and stop background polling", async ({
  page,
  baseURL,
}) => {
  let sessionCalls = 0;
  let privateCalls = 0;
  await page.route("**/api/v1/auth/session", (route) => {
    sessionCalls++;
    return route.fulfill({
      json: {
        authenticated: true,
        user: { id: "viewer", displayName: "Viewer" },
        session: { id: "session" },
      },
    });
  });
  await page.route("**/api/v1/social/revision", (route) =>
    route.fulfill({ json: { revision: 1 } }),
  );
  await page.route("**/api/v1/notifications", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route("**/api/v1/realtime/tickets", (route) =>
    route.fulfill({
      status: 503,
      json: { error: { code: "REALTIME_UNAVAILABLE" } },
    }),
  );
  await page.route("**/api/v1/conversations", (route) => {
    privateCalls++;
    return route.fulfill({ status: 401, json: guestError });
  });
  await page.route("**/api/v1/friendships**", (route) =>
    route.fulfill({ json: { items: [], nextCursor: null } }),
  );
  await page.goto("/friends?conversation=test-id");
  await expect(page).toHaveURL(new URL("/", baseURL).toString());
  const callsAtLanding = privateCalls;
  await page.waitForTimeout(5500);
  expect(privateCalls).toBe(callsAtLanding);
  expect(sessionCalls).toBeLessThanOrEqual(3);
  await expect(page.locator(".friends-redesign-page")).toHaveCount(0);
});

test("temporary session errors show retry without rendering protected content", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill({
      status: 503,
      json: { error: { message: "Temporarily unavailable" } },
    }),
  );
  await page.goto("/friends");
  await expect(
    page.getByRole("heading", { name: "Không thể kiểm tra phiên đăng nhập" }),
  ).toBeVisible();
  await expect(page.locator(".friends-redesign-page")).toHaveCount(0);
  await expect(page).toHaveURL(/\/friends$/);
});

test("a 401 from a mutation also returns to landing", async ({
  page,
  baseURL,
}) => {
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
    route.fulfill({ json: { revision: 1 } }),
  );
  await page.route("**/api/v1/notifications", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route("**/api/v1/realtime/tickets", (route) =>
    route.fulfill({
      status: 503,
      json: { error: { code: "REALTIME_UNAVAILABLE" } },
    }),
  );
  await page.route("**/api/v1/auth/sessions", (route) =>
    route.fulfill({ json: { sessions: [] } }),
  );
  await page.route("**/api/v1/auth/logout-all", (route) =>
    route.fulfill({ status: 401, json: guestError }),
  );
  await page.goto("/account/sessions");
  await page
    .getByRole("button", { name: "Đăng xuất tất cả", exact: true })
    .click();
  await expect(page).toHaveURL(new URL("/", baseURL).toString());
});
