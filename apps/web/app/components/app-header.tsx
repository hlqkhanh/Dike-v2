"use client";

import type {
  AuthSessionResponse,
  JourneyNotification,
} from "@dike/api-client-ts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CarFront,
  Check,
  ChevronRight,
  Clock3,
  List,
  Menu,
  MessageSquareText,
  Settings,
  UserPlus,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { journeyApi } from "../../src/journey/api";
import { DikeLogo } from "./dike-logo";

function notificationTarget(item: JourneyNotification) {
  if (item.data.conversationId)
    return `/inbox/${encodeURIComponent(item.data.conversationId)}`;
  if (item.data.bookingId)
    return `/bookings/${encodeURIComponent(item.data.bookingId)}`;
  if (item.data.proposalId)
    return `/proposals/${encodeURIComponent(item.data.proposalId)}`;
  if (item.data.tripId) return `/trips/${encodeURIComponent(item.data.tripId)}`;
  if (item.data.userId) return `/users/${encodeURIComponent(item.data.userId)}`;
  return "/notifications";
}

function notificationAppearance(item: JourneyNotification) {
  const value = `${item.type} ${item.title}`.toLowerCase();
  if (
    value.includes("friend") ||
    value.includes("kết bạn") ||
    value.includes("connection")
  ) {
    return { Icon: UserPlus, tone: "friend" };
  }
  if (
    value.includes("message") ||
    value.includes("proposal") ||
    value.includes("tin nhắn") ||
    value.includes("đề nghị")
  ) {
    return { Icon: MessageSquareText, tone: "message" };
  }
  return { Icon: CarFront, tone: "trip" };
}

export function AppHeader({ session }: { session: AuthSessionResponse }) {
  const pathname = usePathname();
  const client = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: journeyApi.notifications,
    refetchInterval: 15_000,
  });
  const unread = (notifications.data ?? []).filter(
    (item) => !item.readAt,
  ).length;
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
  useEffect(() => {
    if (!notificationsOpen) return;
    closeButton.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNotificationsOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [notificationsOpen]);

  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 30);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const initials = session.user.displayName
    .split(/\s+/u)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <header className={`new-app-header${scrolled ? " scrolled" : ""}`}>
      <div className="new-app-header-inner">
        <Link
          className="new-app-brand"
          href="/home"
          aria-label="DIKÉ SHARE — Trang chủ"
        >
          <DikeLogo />
        </Link>
        <nav
          className={`new-app-nav${scrolled ? " is-scrolled" : ""}${menuOpen ? " is-open" : ""}`}
          aria-label="Điều hướng chính"
        >
          <Link
            href="/home"
            className={pathname === "/home" ? "nav-link-active" : ""}
            aria-current={pathname === "/home" ? "page" : undefined}
            onClick={() => setMenuOpen(false)}
          >
            Trang chủ
          </Link>
          <Link
            href="/friends"
            className={pathname.startsWith("/friends") ? "nav-link-active" : ""}
            aria-current={pathname.startsWith("/friends") ? "page" : undefined}
            onClick={() => setMenuOpen(false)}
          >
            Bạn bè
          </Link>
          <Link
            href="/profile"
            className={pathname.startsWith("/profile") ? "nav-link-active" : ""}
            aria-current={pathname.startsWith("/profile") ? "page" : undefined}
            onClick={() => setMenuOpen(false)}
          >
            Cá nhân
          </Link>
        </nav>
        <div className="new-app-actions">
          <button
            className="new-notification-button"
            type="button"
            aria-label={`Thông báo${unread ? `, ${unread} chưa đọc` : ""}`}
            aria-expanded={notificationsOpen}
            aria-controls="header-notification-panel"
            onClick={() => setNotificationsOpen((open) => !open)}
          >
            <Bell aria-hidden="true" size={20} />
            {unread ? <span>{unread > 9 ? "9+" : unread}</span> : null}
          </button>
          <Link
            className="new-user-chip"
            href="/profile"
            aria-label={`Hồ sơ ${session.user.displayName}`}
          >
            <span>{initials || "DK"}</span>
            <strong>{session.user.displayName}</strong>
          </Link>
          <button
            className="new-mobile-menu-button"
            type="button"
            aria-label="Mở điều hướng"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      {notificationsOpen ? (
        <div
          className="notification-layer"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget)
              setNotificationsOpen(false);
          }}
        >
          <section
            id="header-notification-panel"
            className="notification-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-title"
          >
            <header>
              <div>
                <p>Cập nhật của bạn</p>
                <h2 id="notification-title">Thông báo</h2>
              </div>
              <button
                ref={closeButton}
                type="button"
                aria-label="Đóng thông báo"
                onClick={() => setNotificationsOpen(false)}
              >
                <X aria-hidden="true" />
              </button>
            </header>
            <div className="notification-panel-toolbar">
              <span>{unread} thông báo chưa đọc</span>
              <button
                type="button"
                disabled={!unread || readAll.isPending}
                onClick={() => readAll.mutate()}
              >
                <Check aria-hidden="true" size={17} />
                Đánh dấu tất cả đã đọc
              </button>
            </div>
            <div className="notification-panel-list">
              {notifications.isPending ? (
                <p>Đang tải thông báo…</p>
              ) : notifications.isError ? (
                <p role="alert">Chưa thể tải thông báo.</p>
              ) : notifications.data?.length ? (
                notifications.data.slice(0, 8).map((item) => {
                  const { Icon, tone } = notificationAppearance(item);
                  return (
                    <Link
                      className={`${item.readAt ? "" : "is-unread"} notification-panel-item`}
                      key={item.id}
                      href={notificationTarget(item)}
                      onClick={() => {
                        if (!item.readAt) readOne.mutate(item.id);
                        setNotificationsOpen(false);
                      }}
                    >
                      <span
                        className={`notification-panel-icon is-${tone}`}
                        aria-hidden="true"
                      >
                        <Icon size={24} strokeWidth={2.1} />
                      </span>
                      <div className="notification-panel-copy">
                        <strong>{item.title}</strong>
                        <p>{item.body}</p>
                        <small>
                          <Clock3 aria-hidden="true" size={14} />
                          {new Date(item.createdAt).toLocaleString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </small>
                      </div>
                      {!item.readAt ? (
                        <span
                          className="notification-panel-unread-dot"
                          aria-label="Chưa đọc"
                        />
                      ) : null}
                    </Link>
                  );
                })
              ) : (
                <div className="notification-empty">
                  <Bell aria-hidden="true" />
                  <strong>Chưa có thông báo mới</strong>
                  <p>Các cập nhật về chuyến đi sẽ xuất hiện tại đây.</p>
                </div>
              )}
            </div>
            <footer>
              <Link
                href="/notifications"
                onClick={() => setNotificationsOpen(false)}
              >
                <List aria-hidden="true" size={18} />
                <span>Xem tất cả thông báo</span>
                <ChevronRight aria-hidden="true" size={18} />
              </Link>
              <Link
                href="/profile?tab=settings"
                onClick={() => setNotificationsOpen(false)}
              >
                <Settings aria-hidden="true" size={18} />
                <span>Cài đặt thông báo</span>
                <ChevronRight aria-hidden="true" size={18} />
              </Link>
            </footer>
          </section>
        </div>
      ) : null}
    </header>
  );
}
