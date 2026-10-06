"use client";

import { Button, Card } from "@dike/web-ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useAuthFailure } from "../../../src/auth/use-auth-failure";
import { profileApi } from "../../../src/profile/api";

export default function PrivacyPage() {
  const client = useQueryClient();
  const privacy = useQuery({
    queryKey: ["privacy", "me"],
    queryFn: profileApi.privacy,
  });
  const [visibility, setVisibility] = useState("MEMBERS");
  const [discoverable, setDiscoverable] = useState(true);
  const [messages, setMessages] = useState(true);
  useEffect(() => {
    if (!privacy.data) return;
    setVisibility(privacy.data.profileVisibility);
    setDiscoverable(privacy.data.discoverableByName);
    setMessages(privacy.data.allowMessageRequests);
  }, [privacy.data]);
  const save = useMutation({
    mutationFn: () =>
      profileApi.updatePrivacy(
        visibility,
        discoverable,
        messages,
        privacy.data?.version ?? 0,
      ),
    onSuccess: (value) => client.setQueryData(["privacy", "me"], value),
  });
  useAuthFailure(privacy.error);
  useAuthFailure(save.error);

  return (
    <main className="settings-page">
      <header>
        <p className="eyebrow">Cài đặt</p>
        <h1>Quyền riêng tư</h1>
        <p className="settings-copy">
          Các lựa chọn này được backend kiểm tra trên mỗi lần đọc.
        </p>
      </header>
      <Card className="settings-card">
        {privacy.isPending ? (
          <p>Đang tải…</p>
        ) : privacy.isError ? (
          <p className="auth-error">Không thể tải cài đặt.</p>
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
                onChange={(event) => setVisibility(event.target.value)}
              >
                <option value="MEMBERS">Thành viên đã đăng nhập</option>
                <option value="PRIVATE">Chỉ mình tôi</option>
              </select>
            </label>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={discoverable}
                onChange={(event) => setDiscoverable(event.target.checked)}
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
                onChange={(event) => setMessages(event.target.checked)}
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
