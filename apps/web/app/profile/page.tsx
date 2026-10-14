"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  CarFront,
  ChevronRight,
  CircleUserRound,
  Handshake,
  MessageCircle,
  Settings,
  ShieldCheck,
  TicketCheck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { profileApi } from "../../src/profile/api";
import { MyProfilePage } from "../me/profile/page";

type ProfileTab = "overview" | "rides" | "messages" | "settings";
const tabs: Array<[ProfileTab, string]> = [
  ["overview", "Tổng quan"],
  ["rides", "Chuyến đi"],
  ["messages", "Tin nhắn"],
  ["settings", "Cài đặt"],
];

export default function ProfileHubPage() {
  const [tab, setTab] = useState<ProfileTab>("overview");
  const profile = useQuery({
    queryKey: ["profile", "me"],
    queryFn: profileApi.myProfile,
  });
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("tab");
    // The URL is the source for the initial active tab on direct navigation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tabs.some(([id]) => id === value)) setTab(value as ProfileTab);
  }, []);
  function choose(next: ProfileTab) {
    setTab(next);
    window.history.replaceState(null, "", `/profile?tab=${next}`);
  }
  return (
    <main className="profile-hub">
      <section className="profile-hub-banner">
        <div className="profile-hub-avatar">
          {profile.data?.avatarUrl ? (
            <Image
              unoptimized
              src={profile.data.avatarUrl}
              width={92}
              height={92}
              alt="Ảnh đại diện"
            />
          ) : (
            <CircleUserRound aria-hidden="true" />
          )}
        </div>
        <div>
          <p>Hồ sơ DIKÉ SHARE</p>
          <h1>{profile.data?.displayName ?? "Thành viên Diké"}</h1>
          <span>
            {profile.data?.bio ||
              "Cùng cộng đồng tạo nên những hành trình xanh hơn."}
          </span>
        </div>
        <Link href="/profile?tab=settings">Cài đặt hồ sơ</Link>
      </section>
      <nav className="profile-hub-tabs" aria-label="Nội dung hồ sơ">
        {tabs.map(([id, label]) => (
          <button
            type="button"
            key={id}
            aria-pressed={tab === id}
            onClick={() => choose(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      {profile.isError ? (
        <p className="profile-hub-error" role="alert">
          Không thể tải thông tin hồ sơ. Các công cụ tài khoản vẫn có thể sử
          dụng bên dưới.
        </p>
      ) : null}
      <section className="profile-hub-content" aria-live="polite">
        {tab === "overview" ? (
          <>
            <div className="profile-overview-card">
              <ShieldCheck aria-hidden="true" />
              <div>
                <p>Trạng thái tài khoản</p>
                <h2>Hoàn thiện độ tin cậy của bạn</h2>
                <span>
                  Xác minh thông tin để mở đầy đủ quyền tài xế và tạo chuyến.
                </span>
              </div>
              <Link href="/verification">
                Kiểm tra xác minh <ChevronRight />
              </Link>
            </div>
            <HubGrid
              items={[
                [
                  "/friends",
                  "Bạn bè",
                  "Kết nối và quản lý lời mời",
                  CircleUserRound,
                ],
                [
                  "/profile?tab=rides",
                  "Hành trình",
                  "Theo dõi mọi chuyến đi",
                  CarFront,
                ],
                [
                  "/profile?tab=messages",
                  "Trao đổi",
                  "Tiếp tục các cuộc hội thoại",
                  MessageCircle,
                ],
              ]}
            />
          </>
        ) : null}
        {tab === "rides" ? (
          <HubGrid
            items={[
              [
                "/trips",
                "Chuyến đã đăng",
                "Quản lý chuyến bạn làm tài xế",
                CarFront,
              ],
              ["/proposals", "Đề nghị", "Phản hồi lời mời đi cùng", Handshake],
              ["/bookings", "Booking", "Chuyến đã được xác nhận", TicketCheck],
              [
                "/schedules",
                "Lịch trình",
                "Kế hoạch di chuyển định kỳ",
                CalendarDays,
              ],
            ]}
          />
        ) : null}
        {tab === "messages" ? (
          <HubGrid
            items={[
              ["/inbox", "Hộp thư", "Xem danh sách hội thoại", MessageCircle],
              [
                "/friends",
                "Bạn bè",
                "Bắt đầu trò chuyện từ kết nối",
                CircleUserRound,
              ],
            ]}
          />
        ) : null}
        {tab === "settings" ? (
          <>
            <MyProfilePage />
            <HubGrid
              items={[
                [
                  "/settings/privacy",
                  "Quyền riêng tư",
                  "Kiểm soát phạm vi chia sẻ",
                  ShieldCheck,
                ],
                [
                  "/settings",
                  "Cài đặt tài khoản",
                  "Consent, thiết bị và tài khoản",
                  Settings,
                ],
              ]}
            />
          </>
        ) : null}
      </section>
    </main>
  );
}

function HubGrid({
  items,
}: {
  items: Array<[string, string, string, typeof CarFront]>;
}) {
  return (
    <div className="profile-hub-grid">
      {items.map(([href, title, text, Icon]) => (
        <Link href={href} key={href}>
          <span>
            <Icon aria-hidden="true" />
          </span>
          <div>
            <h2>{title}</h2>
            <p>{text}</p>
          </div>
          <ChevronRight aria-hidden="true" />
        </Link>
      ))}
    </div>
  );
}
