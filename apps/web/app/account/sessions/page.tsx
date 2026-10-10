"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Laptop, LogOut, ShieldCheck } from "lucide-react";
import { authApi } from "../../../src/auth/api";
import { useAuthFailure } from "../../../src/auth/use-auth-failure";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "../../components/app-ui";

export default function SessionsPage() {
  const router = useRouter();
  const client = useQueryClient();
  const sessions = useQuery({
    queryKey: ["auth", "sessions"],
    queryFn: authApi.sessions,
  });
  const revoke = useMutation({
    mutationFn: authApi.revoke,
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["auth", "sessions"] }),
  });
  const logoutAll = useMutation({
    mutationFn: authApi.logoutAll,
    onSuccess: () => {
      client.clear();
      router.replace("/login");
    },
  });
  useAuthFailure(sessions.error ?? revoke.error ?? logoutAll.error);
  return (
    <main className="settings-page auth-management">
      <PageHeader
        eyebrow="Bảo mật tài khoản"
        title="Các thiết bị đã đăng nhập"
        description="Kiểm tra hoạt động gần nhất và thu hồi những phiên bạn không nhận ra."
        actions={
          <button
            className="app-button app-button--secondary"
            type="button"
            disabled={logoutAll.isPending}
            onClick={() => logoutAll.mutate()}
          >
            <LogOut aria-hidden="true" size={17} /> Đăng xuất tất cả
          </button>
        }
      />
      {sessions.isPending ? (
        <LoadingState label="Đang tải các phiên" />
      ) : sessions.isError ? (
        <ErrorState
          message={sessions.error.message}
          onRetry={() => void sessions.refetch()}
        />
      ) : sessions.data.sessions.length === 0 ? (
        <EmptyState
          icon={Laptop}
          title="Không có phiên hoạt động"
          description="Các thiết bị đã đăng nhập sẽ xuất hiện tại đây."
        />
      ) : (
        <div className="session-list">
          {sessions.data.sessions.map((session) => (
            <article className="settings-card session-card" key={session.id}>
              <span className="session-device-icon">
                <Laptop aria-hidden="true" size={22} />
              </span>
              <div>
                <div className="session-heading">
                  <strong>{session.deviceLabel}</strong>
                  {session.current ? (
                    <span className="status-pill status-pill--success">
                      <ShieldCheck aria-hidden="true" size={14} /> Thiết bị này
                    </span>
                  ) : null}
                </div>
                <p>
                  Hoạt động gần nhất:{" "}
                  <time dateTime={session.lastSeenAt}>
                    {new Date(session.lastSeenAt).toLocaleString("vi-VN")}
                  </time>
                </p>
                <small>
                  Hết hạn:{" "}
                  {new Date(session.absoluteExpiresAt).toLocaleString("vi-VN")}
                </small>
              </div>
              {!session.current ? (
                <button
                  className="app-button app-button--secondary"
                  type="button"
                  disabled={revoke.isPending}
                  onClick={() => revoke.mutate(session.id)}
                >
                  Đăng xuất thiết bị
                </button>
              ) : null}
            </article>
          ))}
        </div>
      )}
      {revoke.isError || logoutAll.isError ? (
        <p className="auth-error" role="alert">
          Không thể cập nhật phiên đăng nhập. Vui lòng thử lại.
        </p>
      ) : null}
    </main>
  );
}
