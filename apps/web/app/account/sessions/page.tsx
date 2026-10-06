"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Status } from "@dike/web-ui";
import { useRouter } from "next/navigation";

import { authApi } from "../../../src/auth/api";
import { useAuthFailure } from "../../../src/auth/use-auth-failure";

export default function SessionsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const sessions = useQuery({
    queryKey: ["auth", "sessions"],
    queryFn: authApi.sessions,
  });
  const revoke = useMutation({
    mutationFn: authApi.revoke,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auth"] }),
  });
  const logoutAll = useMutation({
    mutationFn: authApi.logoutAll,
    onSuccess: () => {
      queryClient.clear();
      router.replace("/login");
    },
  });
  useAuthFailure(sessions.error ?? revoke.error ?? logoutAll.error);

  return (
    <main className="shell auth-management">
      <div>
        <p className="eyebrow">Bảo mật tài khoản</p>
        <h1>Các thiết bị đã đăng nhập</h1>
      </div>
      {sessions.isLoading ? <p aria-live="polite">Đang tải phiên…</p> : null}
      {sessions.isError ? (
        <p className="auth-error" role="alert">
          Không thể tải danh sách phiên.
        </p>
      ) : null}
      <div className="session-list">
        {sessions.data?.sessions.map((session) => (
          <Card key={session.id}>
            <div className="session-heading">
              <strong>{session.deviceLabel}</strong>
              {session.current ? (
                <Status tone="success">Thiết bị này</Status>
              ) : null}
            </div>
            <p>
              Hoạt động gần nhất:{" "}
              {new Date(session.lastSeenAt).toLocaleString("vi-VN")}
            </p>
            <Button
              type="button"
              variant="secondary"
              disabled={revoke.isPending}
              onClick={() => revoke.mutate(session.id)}
            >
              Đăng xuất thiết bị
            </Button>
          </Card>
        ))}
      </div>
      <Button
        type="button"
        disabled={logoutAll.isPending}
        onClick={() => logoutAll.mutate()}
      >
        Đăng xuất tất cả thiết bị
      </Button>
    </main>
  );
}
