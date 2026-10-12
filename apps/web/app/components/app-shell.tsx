"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { authApi } from "../../src/auth/api";
import { AppHeader } from "./app-header";
import { DikeLogo } from "./dike-logo";

const bareRoutes = [
  "/",
  "/login",
  "/auth/complete",
  "/onboarding/phone",
  "/offline",
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const bare = bareRoutes.includes(pathname);
  const session = useQuery({
    queryKey: ["auth", "session"],
    queryFn: authApi.session,
    retry: false,
    enabled: !bare,
  });

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

  return (
    <div className="new-app-shell">
      {session.data ? <AppHeader session={session.data} /> : null}
      <div className="new-app-content">{children}</div>
    </div>
  );
}
