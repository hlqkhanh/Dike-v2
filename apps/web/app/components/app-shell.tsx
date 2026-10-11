"use client";

import {
  Bell,
  CalendarDays,
  CarFront,
  ChevronRight,
  CircleUserRound,
  Compass,
  Handshake,
  Home,
  MapPinned,
  Menu,
  MessageCircle,
  MonitorSmartphone,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  TicketCheck,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { DikeLogo } from "./dike-logo";
import { authApi } from "../../src/auth/api";

const primaryNavigation = [
  { href: "/feed", label: "Bảng tin", icon: Home },
  { href: "/map", label: "Tìm chuyến", icon: MapPinned },
  { href: "/schedules", label: "Lịch trình", icon: CalendarDays },
  { href: "/trips", label: "Chuyến đi", icon: CarFront },
  { href: "/inbox", label: "Tin nhắn", icon: MessageCircle },
  { href: "/friends", label: "Bạn bè", icon: Users },
] as const;

const rideNavigation = [
  { href: "/availability", label: "Khám phá chuyến", icon: Compass },
  { href: "/proposals", label: "Đề nghị", icon: Handshake },
  { href: "/bookings", label: "Booking", icon: TicketCheck },
] as const;

const accountNavigation = [
  { href: "/settings", label: "Cài đặt", icon: Settings },
  { href: "/notifications", label: "Thông báo", icon: Bell },
  { href: "/me/profile", label: "Hồ sơ cá nhân", icon: CircleUserRound },
  { href: "/settings/privacy", label: "Quyền riêng tư", icon: ShieldCheck },
  { href: "/account/sessions", label: "Thiết bị", icon: MonitorSmartphone },
] as const;

const bareRoutes = [
  "/",
  "/login",
  "/auth/complete",
  "/onboarding/phone",
  "/offline",
];

function matches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationGroup({
  label,
  items,
  pathname,
  onNavigate,
}: {
  label: string;
  items: ReadonlyArray<{
    href: string;
    label: string;
    icon: typeof Home;
  }>;
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <div className="app-nav-group">
      <p className="app-nav-label">{label}</p>
      <nav aria-label={label}>
        {items.map(({ href, label: itemLabel, icon: Icon }) => {
          const active = matches(pathname, href);
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className="app-nav-link"
              href={href}
              key={href}
              onClick={onNavigate}
            >
              <Icon aria-hidden="true" size={19} strokeWidth={1.9} />
              <span>{itemLabel}</span>
              {active ? (
                <ChevronRight
                  className="app-nav-arrow"
                  aria-hidden="true"
                  size={16}
                />
              ) : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const bare = bareRoutes.includes(pathname);
  const session = useQuery({
    queryKey: ["auth", "session"],
    queryFn: authApi.session,
    retry: false,
    enabled: !bare,
  });
  const displayName = session.data?.user.displayName ?? "Thành viên Diké";
  const initials =
    displayName
      .split(/\s+/u)
      .filter(Boolean)
      .slice(-2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "DK";

  if (bare) return children;

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="app-shell">
      <aside className={`app-sidebar${menuOpen ? " is-open" : ""}`}>
        <div className="app-sidebar-brand">
          <Link
            href="/feed"
            aria-label="Diké Share — Bảng tin"
            onClick={closeMenu}
          >
            <DikeLogo />
          </Link>
          <button
            className="app-icon-button app-sidebar-close"
            type="button"
            aria-label="Đóng menu"
            onClick={closeMenu}
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>

        <Link
          className="app-create-button"
          href="/trips/new"
          onClick={closeMenu}
        >
          <Plus aria-hidden="true" size={19} />
          Tạo chuyến mới
        </Link>

        <div className="app-sidebar-scroll">
          <NavigationGroup
            label="Di chuyển"
            items={primaryNavigation}
            pathname={pathname}
            onNavigate={closeMenu}
          />
          <NavigationGroup
            label="Kết nối chuyến"
            items={rideNavigation}
            pathname={pathname}
            onNavigate={closeMenu}
          />
          <NavigationGroup
            label="Tài khoản"
            items={accountNavigation}
            pathname={pathname}
            onNavigate={closeMenu}
          />
        </div>

        <Link
          className="app-profile-summary"
          href="/me/profile"
          onClick={closeMenu}
        >
          <span className="app-avatar" aria-hidden="true">
            {initials}
          </span>
          <span>
            <strong>{displayName} · Thành viên</strong>
            <small>Tài khoản Diké</small>
          </span>
          <Settings aria-hidden="true" size={17} />
        </Link>
      </aside>

      {menuOpen ? (
        <button
          className="app-sidebar-backdrop"
          type="button"
          aria-label="Đóng menu"
          onClick={closeMenu}
        />
      ) : null}

      <div className="app-main-column">
        <header className="app-topbar">
          <button
            className="app-icon-button app-menu-button"
            type="button"
            aria-label="Mở menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <Menu aria-hidden="true" size={21} />
          </button>
          <Link
            className="app-command-search"
            href="/availability"
            aria-label="Tìm địa điểm, chuyến đi hoặc bạn bè"
          >
            <Search aria-hidden="true" size={18} />
            <span>Tìm địa điểm, chuyến đi hoặc bạn bè…</span>
            <kbd>⌘ K</kbd>
          </Link>
          <div className="app-topbar-actions">
            {session.data?.user.accessMode === "SIMULATED" ? (
              <Link
                className="simulation-badge app-mode-badge"
                href="/verification"
              >
                Chế độ thử nghiệm
              </Link>
            ) : null}
            <Link
              className="app-icon-button has-indicator"
              href="/notifications"
              aria-label="Thông báo"
            >
              <Bell aria-hidden="true" size={20} />
              <span aria-hidden="true" />
            </Link>
            <Link
              className="app-topbar-profile"
              href="/me/profile"
              aria-label="Mở hồ sơ cá nhân"
            >
              <span className="app-avatar app-avatar--small" aria-hidden="true">
                {initials}
              </span>
              <span>Hồ sơ: {displayName}</span>
            </Link>
          </div>
        </header>
        <div className="app-content">{children}</div>
      </div>

      <nav
        className="app-mobile-nav"
        aria-label="Điều hướng chính trên di động"
      >
        {primaryNavigation.slice(0, 5).map(({ href, label, icon: Icon }) => {
          const active = matches(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
            >
              <Icon aria-hidden="true" size={20} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
