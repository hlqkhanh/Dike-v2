"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { authApi } from "../src/auth/api";
import { expireSession } from "../src/auth/session-expiry";

export function AuthNavigation() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useQuery({
    queryKey: ["auth", "session"],
    queryFn: authApi.session,
    retry: false,
  });
  const logout = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      expireSession(queryClient);
      router.replace("/");
    },
  });

  if (!session.data?.authenticated || !session.data.user) {
    return (
      <Link className="stage-badge stage-badge--cta" href="/login">
        Bắt đầu ngay <span aria-hidden="true">→</span>
      </Link>
    );
  }
  return (
    <div className="nav-account">
      {session.data.user.accessMode === "SIMULATED" ? (
        <Link className="simulation-badge" href="/verification">
          Tài xế thử nghiệm
        </Link>
      ) : null}
      <Link href="/feed">Đi cùng</Link>
      <Link href="/schedules">Lịch trình</Link>
      <Link href="/trips/new">Tạo chuyến</Link>
      <Link href="/friends">Bạn bè</Link>
      <Link href="/availability">Tìm chuyến</Link>
      <Link href="/inbox">Tin nhắn</Link>
      <Link href="/notifications">Thông báo</Link>
      <Link href="/profile">{session.data.user.displayName}</Link>
      <Link href="/settings/privacy">Riêng tư</Link>
      <Link href="/account/sessions">Thiết bị</Link>
      <button
        type="button"
        disabled={logout.isPending}
        onClick={() => logout.mutate()}
      >
        Đăng xuất
      </button>
    </div>
  );
}
