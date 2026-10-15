"use client";

import type { JourneyNotification } from "@dike/api-client-ts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BellRing,
  CalendarDays,
  CarFront,
  Check,
  CheckCheck,
  Ellipsis,
  Inbox,
  Megaphone,
  MessageSquareText,
  MoreHorizontal,
  Star,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { journeyApi } from "../../src/journey/api";
import { EmptyState, ErrorState, LoadingState } from "../components/app-ui";

type NotificationCategory = "all" | "friends" | "trips" | "system" | "other";

const categoryLabels: Record<NotificationCategory, string> = {
  all: "Tất cả",
  friends: "Lời mời kết bạn",
  trips: "Chuyến đi",
  system: "Cập nhật hệ thống",
  other: "Khác",
};

function notificationTarget(item: JourneyNotification) {
  if (item.data.conversationId)
    return `/inbox/${encodeURIComponent(item.data.conversationId)}`;
  if (item.data.bookingId)
    return `/bookings/${encodeURIComponent(item.data.bookingId)}`;
  if (item.data.proposalId)
    return `/proposals/${encodeURIComponent(item.data.proposalId)}`;
  if (item.data.tripId) return `/trips/${encodeURIComponent(item.data.tripId)}`;
  if (item.data.postId) return `/feed/${encodeURIComponent(item.data.postId)}`;
  if (item.data.userId) return `/users/${encodeURIComponent(item.data.userId)}`;
  return undefined;
}

function notificationMeta(item: JourneyNotification) {
  const value = `${item.type} ${item.title}`.toLowerCase();
  if (
    value.includes("friend") ||
    value.includes("connection") ||
    value.includes("kết bạn")
  ) {
    return { category: "friends" as const, Icon: UserPlus, tone: "friend" };
  }
  if (
    value.includes("trip") ||
    value.includes("booking") ||
    value.includes("ride") ||
    value.includes("chuyến")
  ) {
    const Icon = value.includes("sắp") ? CalendarDays : CarFront;
    return { category: "trips" as const, Icon, tone: "trip" };
  }
  if (
    value.includes("system") ||
    value.includes("feature") ||
    value.includes("hệ thống") ||
    value.includes("tính năng")
  ) {
    return { category: "system" as const, Icon: Megaphone, tone: "system" };
  }
  if (value.includes("review") || value.includes("đánh giá")) {
    return { category: "other" as const, Icon: Star, tone: "accent" };
  }
  if (
    value.includes("message") ||
    value.includes("proposal") ||
    value.includes("tin nhắn") ||
    value.includes("đề nghị")
  ) {
    return {
      category: "other" as const,
      Icon: MessageSquareText,
      tone: "message",
    };
  }
  return { category: "other" as const, Icon: Bell, tone: "default" };
}

function dateKey(dateValue: string) {
  const date = new Date(dateValue);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function groupLabel(dateValue: string) {
  const date = new Date(dateValue);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (dateKey(dateValue) === dateKey(today.toISOString())) return "Hôm nay";
  if (dateKey(dateValue) === dateKey(yesterday.toISOString())) return "Hôm qua";
  return date.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(dateValue: string) {
  return new Date(dateValue).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function NotificationsPage() {
  const client = useQueryClient();
  const [category, setCategory] = useState<NotificationCategory>("all");
  const list = useQuery({
    queryKey: ["notifications"],
    queryFn: journeyApi.notifications,
    refetchInterval: 15_000,
  });

  const refresh = () =>
    client.invalidateQueries({ queryKey: ["notifications"] });
  const readAll = useMutation({
    mutationFn: journeyApi.readAllNotifications,
    onMutate: async () => {
      await client.cancelQueries({ queryKey: ["notifications"] });
      const previous = client.getQueryData<JourneyNotification[]>([
        "notifications",
      ]);
      const readAt = new Date().toISOString();
      client.setQueryData<JourneyNotification[]>(["notifications"], (items) =>
        items?.map((item) => ({ ...item, readAt: item.readAt ?? readAt })),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous)
        client.setQueryData(["notifications"], context.previous);
    },
    onSuccess: refresh,
  });
  const readOne = useMutation({
    mutationFn: journeyApi.readNotification,
    onMutate: async (notificationId) => {
      await client.cancelQueries({ queryKey: ["notifications"] });
      const previous = client.getQueryData<JourneyNotification[]>([
        "notifications",
      ]);
      const readAt = new Date().toISOString();
      client.setQueryData<JourneyNotification[]>(["notifications"], (items) =>
        items?.map((item) =>
          item.id === notificationId ? { ...item, readAt } : item,
        ),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous)
        client.setQueryData(["notifications"], context.previous);
    },
    onSuccess: refresh,
  });

  const notifications = [...(list.data ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const unread = notifications.filter((item) => !item.readAt).length;
  const counts = notifications.reduce<Record<NotificationCategory, number>>(
    (result, item) => {
      result[notificationMeta(item).category] += 1;
      return result;
    },
    {
      all: notifications.length,
      friends: 0,
      trips: 0,
      system: 0,
      other: 0,
    },
  );
  const visibleItems = notifications.filter(
    (item) =>
      category === "all" || notificationMeta(item).category === category,
  );
  const groups = visibleItems.reduce<
    Array<{ key: string; label: string; items: JourneyNotification[] }>
  >((result, item) => {
    const key = dateKey(item.createdAt);
    const existing = result.find((group) => group.key === key);
    if (existing) existing.items.push(item);
    else result.push({ key, label: groupLabel(item.createdAt), items: [item] });
    return result;
  }, []);

  const categoryIcons = {
    all: Inbox,
    friends: Users,
    trips: CarFront,
    system: Megaphone,
    other: MoreHorizontal,
  };

  return (
    <main className="notification-center-page">
      <section className="notification-center-hero">
        <div className="notification-center-hero-copy">
          <p>Trung tâm cập nhật</p>
          <h1>Thông báo</h1>
          <span>
            Theo dõi lời mời, thay đổi lịch trình và các cập nhật quan trọng từ
            cộng đồng Diké.
          </span>
        </div>
        <div className="notification-center-art" aria-hidden="true">
          <span className="notification-art-card notification-art-card--left" />
          <span className="notification-art-card notification-art-card--right" />
          <span className="notification-art-bell">
            <BellRing size={54} strokeWidth={1.7} />
          </span>
          <span className="notification-art-check">
            <Check size={24} />
          </span>
          <i className="notification-art-leaf notification-art-leaf--one" />
          <i className="notification-art-leaf notification-art-leaf--two" />
        </div>
      </section>

      <section className="notification-center-layout">
        <aside
          className="notification-category-card"
          aria-label="Danh mục thông báo"
        >
          {(Object.keys(categoryLabels) as NotificationCategory[]).map(
            (key) => {
              const Icon = categoryIcons[key];
              return (
                <button
                  type="button"
                  key={key}
                  className={category === key ? "is-active" : ""}
                  aria-pressed={category === key}
                  onClick={() => setCategory(key)}
                >
                  <Icon aria-hidden="true" size={20} />
                  <span>{categoryLabels[key]}</span>
                  <b>{counts[key]}</b>
                </button>
              );
            },
          )}
        </aside>

        <div className="notification-center-card">
          <header>
            <div>
              <h2>{categoryLabels[category]} thông báo</h2>
              <span>{visibleItems.length} cập nhật</span>
            </div>
            <button
              type="button"
              disabled={!unread || readAll.isPending}
              onClick={() => readAll.mutate()}
            >
              <CheckCheck aria-hidden="true" size={18} />
              Đánh dấu tất cả là đã đọc
            </button>
          </header>

          {list.isPending ? (
            <LoadingState />
          ) : list.isError ? (
            <ErrorState
              message={list.error.message}
              onRetry={() => void list.refetch()}
            />
          ) : groups.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="Không có thông báo trong mục này"
              description="Các cập nhật mới sẽ xuất hiện tại đây."
            />
          ) : (
            <div className="notification-center-groups">
              {groups.map((group) => (
                <section key={group.key} className="notification-center-group">
                  <h3>{group.label}</h3>
                  <div>
                    {group.items.map((item) => {
                      const { Icon, tone } = notificationMeta(item);
                      const href = notificationTarget(item);
                      const content = (
                        <>
                          <span
                            className={`notification-center-item-icon is-${tone}`}
                            aria-hidden="true"
                          >
                            <Icon size={22} strokeWidth={2} />
                          </span>
                          <span className="notification-center-item-copy">
                            <strong>{item.title}</strong>
                            <small>{item.body}</small>
                          </span>
                          <time dateTime={item.createdAt}>
                            {formatTime(item.createdAt)}
                          </time>
                        </>
                      );
                      return (
                        <article
                          key={item.id}
                          className={`notification-center-item${item.readAt ? "" : " is-unread"}`}
                        >
                          {!item.readAt ? (
                            <span
                              className="notification-center-unread-dot"
                              aria-label="Chưa đọc"
                            />
                          ) : null}
                          {href ? (
                            <Link
                              href={href}
                              onClick={() => {
                                if (!item.readAt) readOne.mutate(item.id);
                              }}
                            >
                              {content}
                            </Link>
                          ) : (
                            <div className="notification-center-item-main">
                              {content}
                            </div>
                          )}
                          <button
                            type="button"
                            className="notification-center-item-action"
                            aria-label={
                              item.readAt
                                ? "Thông báo đã đọc"
                                : "Đánh dấu thông báo đã đọc"
                            }
                            disabled={Boolean(item.readAt) || readOne.isPending}
                            onClick={() => readOne.mutate(item.id)}
                          >
                            {item.readAt ? (
                              <Check aria-hidden="true" size={18} />
                            ) : (
                              <Ellipsis aria-hidden="true" size={20} />
                            )}
                          </button>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}

          {readAll.isError || readOne.isError ? (
            <p className="notification-center-error" role="alert">
              Không thể cập nhật trạng thái thông báo. Vui lòng thử lại.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
