"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { authApi } from "../../src/auth/api";
import { AppHeader } from "./app-header";
import { DikeLogo } from "./dike-logo";

const bareRoutes = [
  "/",
  "/login",
  "/auth/complete",
  "/onboarding/phone",
  "/offline",
  "/home",
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const bare = bareRoutes.includes(pathname);
  const session = useQuery({
    queryKey: ["auth", "session"],
    queryFn: authApi.session,
    retry: false,
    enabled: !bare,
  });

  useEffect(() => {
    if (!bare && (session.isError || (!session.isPending && !session.data))) {
      router.replace("/");
    }
  }, [bare, session.isError, session.isPending, session.data, router]);

  if (bare) return children;
  if (session.isPending) {
    return (
      <div className="app-route-skeleton" aria-label="Đang chuẩn bị trang">
        <header>
          <DikeLogo />
          <span />
        </header>
        <main>
          <span />
          <span />
          <span />
        </main>
      </div>
    );
  }

  if (!session.data) {
    return null;
  }

  return (
    <div className="new-app-shell">
      <AppHeader session={session.data} />
      <div className="new-app-content">{children}</div>
    </div>
  );
}
