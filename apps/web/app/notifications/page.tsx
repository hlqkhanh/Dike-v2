"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Info, MessageCircle, Route } from "lucide-react";
import { journeyApi } from "../../src/journey/api";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "../components/app-ui";

export default function NotificationsPage() {
  const client = useQueryClient();
  const list = useQuery({
    queryKey: ["notifications"],
    queryFn: journeyApi.notifications,
    refetchInterval: 15000,
  });
  const readAll = useMutation({
    mutationFn: journeyApi.readAllNotifications,
    onSuccess: async () =>
      client.invalidateQueries({ queryKey: ["notifications"] }),
  });
  return (
    <main className="settings-page notifications-page">
      <PageHeader
        eyebrow="Trung tâm cập nhật"
        title="Thông báo"
        description="Theo dõi lời mời, thay đổi lịch trình và các cập nhật quan trọng từ cộng đồng Diké."
        actions={
          <button
            className="app-button app-button--secondary"
            onClick={() => readAll.mutate()}
            disabled={readAll.isPending}
          >
            <CheckCheck aria-hidden="true" size={18} /> Đánh dấu tất cả đã đọc
          </button>
        }
      />
      {list.isPending ? (
        <LoadingState />
      ) : list.isError ? (
        <ErrorState
          message={list.error.message}
          onRetry={() => void list.refetch()}
        />
      ) : list.data.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Bạn đã xem hết thông báo"
          description="Những cập nhật mới về chuyến đi, đề nghị và tin nhắn sẽ xuất hiện tại đây."
        />
      ) : (
        <section className="notification-list" aria-label="Thông báo gần đây">
          <div className="notification-date-label">Gần đây</div>
          {list.data.map((item) => {
            const lower = `${item.title} ${item.body}`.toLowerCase();
            const Icon = lower.includes("tin nhắn")
              ? MessageCircle
              : lower.includes("chuyến")
                ? Route
                : Info;
            return (
              <article
                className={`settings-card notification-item${item.readAt ? "" : " is-unread"}`}
                key={item.id}
              >
                <span className="notification-icon">
                  <Icon aria-hidden="true" size={20} />
                </span>
                <div>
                  <h2>{item.title}</h2>
                  <p>{item.body}</p>
                  <small>
                    {new Date(item.createdAt).toLocaleString("vi-VN")} ·{" "}
                    {item.readAt ? "Đã đọc" : "Chưa đọc"}
                  </small>
                </div>
                {!item.readAt ? (
                  <span
                    className="notification-unread-dot"
                    aria-label="Chưa đọc"
                  />
                ) : null}
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
