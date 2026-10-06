"use client";

import { ApiError } from "@dike/api-client-ts";
import { Button, Card } from "@dike/web-ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuthFailure } from "../../../src/auth/use-auth-failure";
import { profileApi } from "../../../src/profile/api";

export default function AccountSettingsPage() {
  const router = useRouter();
  const client = useQueryClient();
  const [confirmed, setConfirmed] = useState(false);
  const deletion = useQuery({
    queryKey: ["account", "deletion"],
    queryFn: profileApi.deletion,
    retry: false,
  });
  const request = useMutation({
    mutationFn: () => profileApi.requestDeletion(crypto.randomUUID()),
    onSuccess: () => {
      client.clear();
      router.replace("/login?notice=ACCOUNT_DELETION_REQUESTED");
    },
  });
  useAuthFailure(deletion.error);

  return (
    <main className="settings-page">
      <header>
        <p className="eyebrow">Tài khoản</p>
        <h1>Xóa tài khoản</h1>
        <p className="settings-copy">
          Yêu cầu được xử lý bất đồng bộ sau thời gian chờ. Backup có thể tuân
          theo retention riêng.
        </p>
      </header>
      <Card className="settings-card danger-card">
        {deletion.data ? (
          <>
            <h2>Yêu cầu đang được xử lý</h2>
            <p>
              Dự kiến bắt đầu sau{" "}
              <time>
                {new Date(deletion.data.executeAfter).toLocaleString("vi-VN")}
              </time>
              .
            </p>
          </>
        ) : (
          <>
            <h2>Đây là hành động nghiêm trọng</h2>
            <p>
              Phiên đăng nhập sẽ bị thu hồi ngay. Hồ sơ và file do identity sở
              hữu sẽ được xóa theo policy hiện hành.
            </p>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              <span>
                Tôi hiểu yêu cầu này chưa thể hoàn tác trong phiên bản hiện tại.
              </span>
            </label>
            {request.error instanceof ApiError ? (
              <p className="auth-error" role="alert">
                {request.error.code === "ACCOUNT_DELETION_REAUTH_REQUIRED" ? (
                  <>
                    Bạn cần{" "}
                    <a href="/api/v1/auth/google">đăng nhập lại bằng Google</a>{" "}
                    trong vòng 5 phút.
                  </>
                ) : (
                  request.error.message
                )}
              </p>
            ) : null}
            <Button
              type="button"
              disabled={!confirmed || request.isPending}
              onClick={() => request.mutate()}
            >
              {request.isPending
                ? "Đang gửi yêu cầu…"
                : "Yêu cầu xóa tài khoản"}
            </Button>
          </>
        )}
      </Card>
    </main>
  );
}
