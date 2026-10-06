"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { authApi } from "../../../src/auth/api";
import { useAuthFailure } from "../../../src/auth/use-auth-failure";

export default function AuthCompletePage() {
  const router = useRouter();
  const session = useQuery({
    queryKey: ["auth", "session"],
    queryFn: authApi.session,
  });
  useAuthFailure(session.error);

  useEffect(() => {
    if (!session.data) return;
    const destination =
      session.data.user.nextAction === "REVIEW_CONSENT"
        ? "/settings/consent"
        : session.data.user.nextAction === "SUBMIT_PHONE" ||
            session.data.user.nextAction === "VERIFY_PHONE"
          ? "/onboarding/phone"
          : "/";
    router.replace(destination);
  }, [router, session.data]);

  if (session.isError) {
    return (
      <main className="auth-page">
        <section className="auth-card" role="alert">
          <h1>Không thể hoàn tất đăng nhập</h1>
          <a className="auth-action" href="/login">
            Thử lại
          </a>
        </section>
      </main>
    );
  }
  return (
    <main className="auth-page" aria-live="polite">
      <section className="auth-card">
        <p className="eyebrow">Đang bảo vệ phiên của bạn</p>
        <h1>Đang hoàn tất đăng nhập…</h1>
      </section>
    </main>
  );
}
