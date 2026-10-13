import { describe, expect, it } from "vitest";

import { onboardingDestination } from "./onboarding-destination";

describe("onboardingDestination", () => {
  it.each([
    ["REVIEW_CONSENT", "/settings/consent?flow=onboarding"],
    ["SUBMIT_PHONE", "/onboarding/phone"],
    ["VERIFY_PHONE", "/onboarding/phone"],
    ["NONE", "/home"],
  ])("maps %s to %s", (nextAction, expected) => {
    expect(onboardingDestination(nextAction)).toBe(expected);
  });
});
