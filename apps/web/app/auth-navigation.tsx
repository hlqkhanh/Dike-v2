"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { authApi } from "../src/auth/api";

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
      queryClient.clear();
      router.push("/login");
    },
  });

  if (!session.data) {
    return (
      <Link className="stage-badge" href="/login">
        Đăng nhập
      </Link>
    );
  }
  return (
    <div className="nav-account">
      <Link href="/feed">Đi cùng</Link>
      <Link href="/friends">Bạn bè</Link>
      <Link href="/me/profile">{session.data.user.displayName}</Link>
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
