import { expect, it } from "vitest";
import { hasStandaloneLayout, requiresAuthentication } from "./route-access";

it.each(["/", "/login", "/offline", "/login/"])("keeps %s public", (route) => {
  expect(requiresAuthentication(route)).toBe(false);
});

it.each([
  "/friends",
  "/inbox/chat",
  "/home",
  "/auth/complete",
  "/onboarding/phone",
  "/admin",
  "/new-private-page",
])("protects %s including new and standalone pages", (route) => {
  expect(requiresAuthentication(route)).toBe(true);
});

it("does not confuse a standalone layout with a public route", () => {
  expect(hasStandaloneLayout("/home")).toBe(true);
  expect(requiresAuthentication("/home")).toBe(true);
});
