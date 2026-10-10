"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  Info,
  MessageCircle,
  Route,
} from "lucide-react";
import { journeyApi } from "../../src/journey/api";
import type { JourneyNotification } from "@dike/api-client-ts";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "../components/app-ui";

function target(item: JourneyNotification) {
  if (item.data.conversationId)
    return `/inbox/${encodeURIComponent(item.data.conversationId)}`;
  if (item.data.bookingId)
    return `/bookings/${encodeURIComponent(item.data.bookingId)}`;
  if (item.data.proposalId)
    return `/proposals/${encodeURIComponent(item.data.proposalId)}`;
  if (item.data.tripId) return `/trips/${encodeURIComponent(item.data.tripId)}`;
  if (item.data.userId) return `/users/${encodeURIComponent(item.data.userId)}`;
}

export default function NotificationsPage() {
  const client = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const list = useQuery({
    queryKey: ["notifications"],
    queryFn: journeyApi.notifications,
    refetchInterval: 15000,
  });
  const refresh = () =>
    client.invalidateQueries({ queryKey: ["notifications"] });
  const readAll = useMutation({
    mutationFn: journeyApi.readAllNotifications,
    onSuccess: refresh,
  });
  const readOne = useMutation({
    mutationFn: journeyApi.readNotification,
    onSuccess: refresh,
  });
  const items = (list.data ?? []).filter((item) => !unreadOnly || !item.readAt);
  const unread = (list.data ?? []).filter((item) => !item.readAt).length;
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
            disabled={readAll.isPending || unread === 0}
          >
            <CheckCheck aria-hidden="true" size={18} /> Đánh dấu tất cả đã đọc
          </button>
        }
      />
      <div className="notification-toolbar">
        <div className="app-filter-tabs" aria-label="Lọc thông báo">
          <button
            type="button"
            aria-pressed={!unreadOnly}
            onClick={() => setUnreadOnly(false)}
          >
            Tất cả
          </button>
          <button
            type="button"
            aria-pressed={unreadOnly}
            onClick={() => setUnreadOnly(true)}
          >
            Chưa đọc ({unread})
          </button>
        </div>
      </div>
      {list.isPending ? (
        <LoadingState />
      ) : list.isError ? (
        <ErrorState
          message={list.error.message}
          onRetry={() => void list.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={
            unreadOnly
              ? "Không còn thông báo chưa đọc"
              : "Bạn đã xem hết thông báo"
          }
          description="Những cập nhật mới về chuyến đi, đề nghị và tin nhắn sẽ xuất hiện tại đây."
        />
      ) : (
        <section className="notification-list" aria-label="Thông báo gần đây">
          {items.map((item) => {
            const lower = `${item.type} ${item.title}`.toLowerCase();
            const Icon =
              lower.includes("message") || lower.includes("tin nhắn")
                ? MessageCircle
                : lower.includes("trip") ||
                    lower.includes("booking") ||
                    lower.includes("chuyến")
                  ? Route
                  : Info;
            const href = target(item);
            const content = (
              <>
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
              </>
            );
            return (
              <article
                className={`settings-card notification-item${item.readAt ? "" : " is-unread"}`}
                key={item.id}
              >
                {href ? (
                  <Link
                    className="notification-main"
                    href={href}
                    onClick={() => {
                      if (!item.readAt) readOne.mutate(item.id);
                    }}
                  >
                    {content}
                  </Link>
                ) : (
                  content
                )}
                {!item.readAt ? (
                  <button
                    className="app-icon-button"
                    type="button"
                    aria-label="Đánh dấu đã đọc"
                    disabled={readOne.isPending}
                    onClick={() => readOne.mutate(item.id)}
                  >
                    <Check aria-hidden="true" size={17} />
                  </button>
                ) : null}
              </article>
            );
          })}
        </section>
      )}
      {readAll.isError || readOne.isError ? (
        <p className="auth-error" role="alert">
          Không thể cập nhật trạng thái thông báo. Vui lòng thử lại.
        </p>
      ) : null}
    </main>
  );
}
