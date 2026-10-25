import { Redirect } from "expo-router";
import { SessionLoading } from "@/components/SessionLoading";

import { useSession } from "@/core/session";

export default function Index() {
  const { loading, session } = useSession();
  if (loading) return <SessionLoading />;
  if (!session?.authenticated) return <Redirect href="/sign-in" />;
  if (session.user.nextAction === "REVIEW_CONSENT")
    return <Redirect href="/settings/consent" />;
  if (["SUBMIT_PHONE", "VERIFY_PHONE"].includes(session.user.nextAction))
    return <Redirect href="/onboarding/phone" />;
  return <Redirect href="/(tabs)" />;
}
