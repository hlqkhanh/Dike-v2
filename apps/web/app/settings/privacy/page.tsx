"use client";

import { Button, Card } from "@dike/web-ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useAuthFailure } from "../../../src/auth/use-auth-failure";
import { profileApi } from "../../../src/profile/api";
import { ErrorState, LoadingState, PageHeader } from "../../components/app-ui";

export default function PrivacyPage() {
  const client = useQueryClient();
  const privacy = useQuery({
    queryKey: ["privacy", "me"],
    queryFn: profileApi.privacy,
  });
  const [draft, setDraft] = useState<typeof privacy.data>();
  const current = draft ?? privacy.data;
  const visibility = current?.profileVisibility ?? "MEMBERS";
  const discoverable = current?.discoverableByName ?? true;
  const messages = current?.allowMessageRequests ?? true;
  const save = useMutation({
    mutationFn: () =>
      profileApi.updatePrivacy(
        visibility,
        discoverable,
        messages,
        current?.version ?? 0,
      ),
    onSuccess: (value) => {
      client.setQueryData(["privacy", "me"], value);
      setDraft(undefined);
    },
  });
  useAuthFailure(privacy.error);
  useAuthFailure(save.error);

  return (
    <main className="settings-page">
      <PageHeader
        eyebrow="Cài đặt"
        title="Quyền riêng tư"
        description="Kiểm soát ai có thể tìm thấy, xem hồ sơ và gửi yêu cầu nhắn tin cho bạn."
      />
      <Card className="settings-card">
        {privacy.isPending ? (
          <LoadingState label="Đang tải quyền riêng tư" />
        ) : privacy.isError ? (
          <ErrorState
            message={privacy.error.message}
            onRetry={() => void privacy.refetch()}
          />
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <label className="dike-field">
              <span>Ai có thể xem hồ sơ cơ bản</span>
              <select
                value={visibility}
                onChange={(event) =>
                  current &&
                  setDraft({
                    ...current,
                    profileVisibility: event.target.value,
                  })
                }
              >
                <option value="MEMBERS">Thành viên đã đăng nhập</option>
                <option value="PRIVATE">Chỉ mình tôi</option>
              </select>
            </label>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={discoverable}
                onChange={(event) =>
                  current &&
                  setDraft({
                    ...current,
                    discoverableByName: event.target.checked,
                  })
                }
              />
              <span>
                <strong>Cho phép tìm bằng tên</strong>
                <small>Không cho phép tìm bằng email hoặc số điện thoại.</small>
              </span>
            </label>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={messages}
                onChange={(event) =>
                  current &&
                  setDraft({
                    ...current,
                    allowMessageRequests: event.target.checked,
                  })
                }
              />
              <span>
                <strong>Cho phép yêu cầu nhắn tin</strong>
                <small>Thiết lập sẽ được dùng khi chat ra mắt.</small>
              </span>
            </label>
            {save.isError ? (
              <p className="auth-error" role="alert">
                Không thể lưu. Có thể cài đặt đã thay đổi ở nơi khác.
              </p>
            ) : null}
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Đang lưu…" : "Lưu quyền riêng tư"}
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
