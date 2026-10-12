"use client";

import type {
  AuthSessionResponse,
  JourneyNotification,
} from "@dike/api-client-ts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { authApi } from "../../src/auth/api";
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
  return "/";
}

export function AppHeader({ session }: { session: AuthSessionResponse }) {
  const pathname = usePathname();
  const router = useRouter();
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
    onSuccess: refresh,
  });
  const readOne = useMutation({
    mutationFn: journeyApi.readNotification,
    onSuccess: refresh,
  });
  const logout = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      client.clear();
      router.push("/login");
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
          href="/"
          aria-label="DIKÉ SHARE — Trang chủ"
        >
          <DikeLogo />
        </Link>
        <nav
          className={`new-app-nav${scrolled ? " is-scrolled" : ""}${menuOpen ? " is-open" : ""}`}
          aria-label="Điều hướng chính"
        >
          <Link
            href="/"
            className={pathname === "/" ? "nav-link-active" : ""}
            aria-current={pathname === "/" ? "page" : undefined}
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
            onClick={() => setNotificationsOpen(true)}
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
                <X />
              </button>
            </header>
            <div className="notification-panel-toolbar">
              <span>{unread} thông báo chưa đọc</span>
              <button
                type="button"
                disabled={!unread || readAll.isPending}
                onClick={() => readAll.mutate()}
              >
                <CheckCheck aria-hidden="true" size={16} />
                Đọc tất cả
              </button>
            </div>
            <div className="notification-panel-list">
              {notifications.isPending ? (
                <p>Đang tải thông báo…</p>
              ) : notifications.isError ? (
                <p role="alert">Chưa thể tải thông báo.</p>
              ) : notifications.data?.length ? (
                notifications.data.slice(0, 8).map((item) => (
                  <Link
                    className={item.readAt ? "" : "is-unread"}
                    key={item.id}
                    href={notificationTarget(item)}
                    onClick={() => {
                      if (!item.readAt) readOne.mutate(item.id);
                      setNotificationsOpen(false);
                    }}
                  >
                    <span aria-hidden="true" />
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.body}</p>
                      <small>
                        {new Date(item.createdAt).toLocaleString("vi-VN")}
                      </small>
                    </div>
                  </Link>
                ))
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
                href="/profile?tab=settings"
                onClick={() => setNotificationsOpen(false)}
              >
                Cài đặt thông báo
              </Link>
              <button
                type="button"
                disabled={logout.isPending}
                onClick={() => logout.mutate()}
              >
                <LogOut aria-hidden="true" size={16} />
                Đăng xuất
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </header>
  );
}
