export function onboardingDestination(nextAction: string) {
  return nextAction === "REVIEW_CONSENT"
    ? "/settings/consent?flow=onboarding"
    : nextAction === "SUBMIT_PHONE" || nextAction === "VERIFY_PHONE"
      ? "/onboarding/phone"
      : "/home";
}
