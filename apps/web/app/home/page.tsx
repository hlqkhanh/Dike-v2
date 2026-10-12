"use client";

import type { AuthSessionResponse } from "@dike/api-client-ts";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { authApi } from "../../src/auth/api";
import { AuthenticatedHome } from "../components/authenticated-home";

export default function AuthenticatedHomePage() {
  const router = useRouter();
  const isPreview =
    typeof window !== "undefined" &&
    window.location.search.includes("preview=true");
  const session = useQuery({
    queryKey: ["auth", "session"],
    queryFn: authApi.session,
    retry: false,
    enabled: !isPreview,
  });

  useEffect(() => {
    if (isPreview) return;
    if (session.isError || (!session.isPending && !session.data)) {
      router.replace("/");
    }
  }, [isPreview, session.isError, session.isPending, session.data, router]);

  if (isPreview) {
    return (
      <AuthenticatedHome
        session={
          {
            user: {
              id: "preview-user",
              displayName: "Khánh Hồ",
              email: "khanh@example.com",
              role: "USER",
            },
          } as unknown as AuthSessionResponse
        }
      />
    );
  }

  if (session.isPending) {
    return (
      <div
        className="home-session-skeleton"
        aria-label="Đang chuẩn bị trang chủ"
      >
        <div className="home-skeleton-hero">
          <span className="home-skeleton-line home-skeleton-line--title" />
          <span className="home-skeleton-line" />
          <span className="home-skeleton-search" />
        </div>
      </div>
    );
  }

  if (!session.data) {
    return null;
  }

  return <AuthenticatedHome session={session.data} />;
}
