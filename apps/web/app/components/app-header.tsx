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
  ChevronDown,
  ChevronRight,
  Clock3,
  List,
  LogOut,
  Menu,
  MessageSquareText,
  Settings,
  UserRound,
  UserPlus,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { journeyApi } from "../../src/journey/api";
import { authApi } from "../../src/auth/api";
import { expireSession } from "../../src/auth/session-expiry";
import { DikeLogo } from "./dike-logo";

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

export function AppHeader({
  session,
  scrollState,
}: {
  session: AuthSessionResponse;
  scrollState?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isFriendsSection =
    pathname.startsWith("/friends") || pathname.startsWith("/inbox");
  const client = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenu = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: journeyApi.notifications,
    refetchInterval: 15_000,
  });
  const unread = (notifications.data ?? []).filter(
    (item) => !item.readAt,
  ).length;
  const orderedNotifications = useMemo(
    () =>
      [...(notifications.data ?? [])].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [notifications.data],
  );
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
  const logout = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      expireSession(client);
      router.replace("/");
    },
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
  useEffect(() => {
    if (!profileMenuOpen) return;
    const closeProfileMenu = (event: PointerEvent) => {
      if (!profileMenu.current?.contains(event.target as Node))
        setProfileMenuOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeProfileMenu);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", closeProfileMenu);
      document.removeEventListener("keydown", handleKey);
    };
  }, [profileMenuOpen]);

  const [windowScrolled, setWindowScrolled] = useState(false);
  const scrolled = scrollState ?? windowScrolled;

  useEffect(() => {
    if (scrollState !== undefined) return;
    const handleScroll = () => {
      setWindowScrolled(window.scrollY > 30);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [scrollState]);

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
            className={isFriendsSection ? "nav-link-active" : ""}
            aria-current={isFriendsSection ? "page" : undefined}
            onClick={() => setMenuOpen(false)}
          >
            Bạn bè
          </Link>
          <Link
            href="/journeys"
            className={
              ["/journeys", "/schedules", "/proposals", "/bookings"].some(
                (route) => pathname.startsWith(route),
              )
                ? "nav-link-active"
                : ""
            }
            aria-current={pathname === "/journeys" ? "page" : undefined}
            onClick={() => setMenuOpen(false)}
          >
            Chuyến đi
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
            onClick={() => {
              setProfileMenuOpen(false);
              setNotificationsOpen((open) => !open);
            }}
          >
            <Bell aria-hidden="true" size={20} />
            {unread ? <span>{unread > 9 ? "9+" : unread}</span> : null}
          </button>
          <div className="new-user-menu" ref={profileMenu}>
            <button
              className="new-user-chip"
              type="button"
              aria-label={`Mở menu tài khoản ${session.user.displayName}`}
              aria-haspopup="menu"
              aria-expanded={profileMenuOpen}
              onClick={() => {
                setNotificationsOpen(false);
                setProfileMenuOpen((open) => !open);
              }}
            >
              <span>{initials || "DK"}</span>
              <strong>{session.user.displayName}</strong>
              <ChevronDown
                className={profileMenuOpen ? "is-open" : ""}
                aria-hidden="true"
                size={16}
              />
            </button>
            {profileMenuOpen ? (
              <div className="new-user-dropdown" role="menu">
                <Link
                  href="/profile"
                  role="menuitem"
                  onClick={() => setProfileMenuOpen(false)}
                >
                  <UserRound aria-hidden="true" size={18} />
                  <span>
                    <strong>Thông tin chi tiết</strong>
                    <small>Xem và chỉnh sửa hồ sơ</small>
                  </span>
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  disabled={logout.isPending}
                  onClick={() => logout.mutate()}
                >
                  <LogOut aria-hidden="true" size={18} />
                  <span>
                    <strong>
                      {logout.isPending ? "Đang đăng xuất…" : "Đăng xuất"}
                    </strong>
                    <small>Kết thúc phiên hiện tại</small>
                  </span>
                </button>
              </div>
            ) : null}
          </div>
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
              ) : orderedNotifications.length ? (
                orderedNotifications.slice(0, 8).map((item) => {
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
                href="/settings"
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
