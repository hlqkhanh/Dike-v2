"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { ApiError } from "@dike/api-client-ts";

import { authApi } from "../../src/auth/api";
import { AppHeader } from "./app-header";
import { DikeLogo } from "./dike-logo";
import { ErrorState } from "./app-ui";
import {
  hasStandaloneLayout,
  requiresAuthentication,
} from "../../src/auth/route-access";
import { SocialSessionMonitor } from "../../src/social/invalidation";
import { JourneyRealtimeMonitor } from "../../src/journey/realtime";
import { AssistantWidget } from "../../src/assistant/assistant-widget";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (!requiresAuthentication(pathname)) return children;
  return (
    <>
      <AuthenticatedShell key={pathname} pathname={pathname}>
        {children}
      </AuthenticatedShell>
      <AssistantWidget />
    </>
  );
}

function AuthenticatedShell({
  children,
  pathname,
}: {
  children: ReactNode;
  pathname: string;
}) {
  const router = useRouter();
  const session = useQuery({
    queryKey: ["auth", "session"],
    queryFn: authApi.session,
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });
  const authenticated =
    session.data?.authenticated === true && Boolean(session.data.user?.id);
  const anonymous =
    session.isFetchedAfterMount &&
    ((session.isSuccess && !authenticated) ||
      (session.error instanceof ApiError && session.error.status === 401));
  useEffect(() => {
    if (anonymous) router.replace("/");
  }, [anonymous, router]);

  if (anonymous) return null;
  if (session.isPending || !session.isFetchedAfterMount) {
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
  if (session.isError)
    return (
      <main className="settings-page">
        <ErrorState
          title="Không thể kiểm tra phiên đăng nhập"
          message="Vui lòng thử lại để tiếp tục."
          onRetry={() => void session.refetch()}
        />
      </main>
    );
  if (!authenticated || !session.data) return null;

  return (
    <>
      <SocialSessionMonitor />
      <JourneyRealtimeMonitor />
      {hasStandaloneLayout(pathname) ? (
        children
      ) : (
        <div className="new-app-shell">
          <AppHeader session={session.data} />
          <div className="new-app-content">{children}</div>
        </div>
      )}
    </>
  );
}
