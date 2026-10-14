"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  CarFront,
  ChevronRight,
  Facebook,
  Mail,
  MapPin,
  Phone,
  Plus,
  Settings,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { profileApi } from "../../src/profile/api";
import { authApi } from "../../src/auth/api";
import { rideApi } from "../../src/rides/api";
import { socialApi } from "../../src/social/api";
import { EmptyState, ErrorState, LoadingState } from "../components/app-ui";

const statusNames: Record<string, string> = {
  DRAFT: "Bản nháp",
  OPEN: "Đang mở",
  MATCHED: "Đã ghép",
  FULL: "Đủ chỗ",
  IN_PROGRESS: "Đang đi",
  COMPLETED: "Hoàn tất",
  CLOSED: "Đã đóng",
  CANCELLED: "Đã hủy",
  EXPIRED: "Hết hạn",
};

const initials = (name: string) =>
  name
    .split(/\s+/u)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const tripDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa đặt thời gian";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export default function ProfileHubPage() {
  const profile = useQuery({
    queryKey: ["profile", "me"],
    queryFn: profileApi.myProfile,
  });
  const session = useQuery({
    queryKey: ["auth", "session"],
    queryFn: authApi.session,
  });
  const trips = useQuery({
    queryKey: ["rides", "trips", "profile-preview"],
    queryFn: () => rideApi.trips(),
  });
  const friends = useQuery({
    queryKey: ["social", "profile-preview", "friends"],
    queryFn: () => socialApi.list("friends"),
  });

  const displayName = profile.data?.displayName ?? "Thành viên Diké";
  const recentTrips = trips.data?.items.slice(0, 5) ?? [];
  const friendPreview = friends.data?.items.slice(0, 6) ?? [];

  return (
    <main className="profile-dashboard">
      <section className="profile-dashboard-banner">
        <div className="profile-dashboard-avatar">
          {profile.data?.avatarUrl ? (
            <Image
              unoptimized
              src={profile.data.avatarUrl}
              width={104}
              height={104}
              alt={`Ảnh đại diện của ${displayName}`}
            />
          ) : (
            <span>{initials(displayName) || "DK"}</span>
          )}
        </div>
        <div className="profile-dashboard-identity">
          <p>Hồ sơ Diké Share</p>
          <h1>{displayName}</h1>
          <span>
            {profile.data?.bio ||
              "Cùng cộng đồng tạo nên những hành trình xanh hơn."}
          </span>
          <Link className="profile-settings-button" href="/settings">
            <Settings aria-hidden="true" size={16} /> Cài đặt
          </Link>
        </div>
      </section>

      {profile.isError ? (
        <p className="profile-hub-error" role="alert">
          Không thể tải đầy đủ thông tin hồ sơ.
        </p>
      ) : null}

      <div className="profile-dashboard-grid">
        <aside className="profile-dashboard-sidebar">
          <section className="profile-info-panel">
            <header>
              <h2>Thông tin cá nhân</h2>
              <Link href="/me/profile">Chỉnh sửa thông tin</Link>
            </header>
            {profile.data?.dateOfBirth ? (
              <div className="profile-info-row">
                <CalendarDays aria-hidden="true" />
                <div>
                  <strong>
                    {new Intl.DateTimeFormat("vi-VN").format(
                      new Date(`${profile.data.dateOfBirth}T00:00:00`),
                    )}
                  </strong>
                </div>
              </div>
            ) : null}
            {profile.data?.provinceName ? (
              <div className="profile-info-row">
                <MapPin aria-hidden="true" />
                <div>
                  <strong>
                    {[profile.data.localityName, profile.data.provinceName]
                      .filter(Boolean)
                      .join(", ")}
                  </strong>
                </div>
              </div>
            ) : null}
            {session.data?.user.phoneMasked || profile.data?.contactPhone ? (
              <div className="profile-info-row">
                <Phone aria-hidden="true" />
                <div>
                  <strong>
                    {session.data?.user.phoneMasked ||
                      profile.data?.contactPhone}
                  </strong>
                </div>
              </div>
            ) : null}
            {session.data?.user.email || profile.data?.contactEmail ? (
              <div className="profile-info-row">
                <Mail aria-hidden="true" />
                <div>
                  <strong>
                    {session.data?.user.email || profile.data?.contactEmail}
                  </strong>
                </div>
              </div>
            ) : null}
            {profile.data?.facebookUrl ? (
              <a
                className="profile-info-social"
                href={profile.data.facebookUrl}
                target="_blank"
                rel="noreferrer"
              >
                <Facebook aria-hidden="true" /> Xem trang Facebook
              </a>
            ) : null}
          </section>

          <section className="profile-friends-panel">
            <header>
              <div>
                <h2>Bạn bè</h2>
                <span>{friends.data?.items.length ?? 0} người bạn</span>
              </div>
              <Link href="/friends">
                Xem tất cả <ChevronRight aria-hidden="true" size={17} />
              </Link>
            </header>
            {friends.isPending ? (
              <LoadingState label="Đang tải bạn bè" />
            ) : null}
            {friends.isError ? (
              <p className="profile-inline-error">Chưa thể tải bạn bè.</p>
            ) : null}
            {!friends.isPending &&
            !friends.isError &&
            friendPreview.length === 0 ? (
              <p className="profile-inline-empty">
                Kết nối với bạn bè để cùng chia sẻ hành trình.
              </p>
            ) : null}
            <div className="profile-friend-grid">
              {friendPreview.map((friend, index) => (
                <Link
                  href={`/users/${encodeURIComponent(friend.userId)}`}
                  key={friend.userId}
                >
                  <span
                    className={`profile-friend-avatar is-tone-${(index % 4) + 1}`}
                  >
                    {initials(friend.displayName)}
                  </span>
                  <strong>{friend.displayName}</strong>
                </Link>
              ))}
            </div>
          </section>
        </aside>

        <section className="profile-trips-panel">
          <header className="profile-trips-heading">
            <div>
              <p>Hành trình của bạn</p>
              <h2>Chuyến đi đã đăng</h2>
            </div>
            <Link href="/trips/new">
              <Plus aria-hidden="true" size={19} /> Đăng chuyến đi
            </Link>
          </header>

          {trips.isPending ? <LoadingState label="Đang tải chuyến đi" /> : null}
          {trips.isError ? (
            <ErrorState
              message="Không thể tải chuyến đi của bạn."
              onRetry={() => void trips.refetch()}
            />
          ) : null}
          {!trips.isPending && !trips.isError && recentTrips.length === 0 ? (
            <EmptyState
              icon={CarFront}
              title="Bạn chưa đăng chuyến đi nào"
              description="Tạo chuyến đầu tiên để tìm người đồng hành phù hợp."
              action={
                <Link
                  className="app-button app-button--primary"
                  href="/trips/new"
                >
                  <Plus aria-hidden="true" size={18} /> Đăng chuyến đầu tiên
                </Link>
              }
            />
          ) : null}

          <div className="profile-trip-list">
            {recentTrips.map((trip) => (
              <article className="profile-trip-card" key={trip.id}>
                <header>
                  <span
                    className={`profile-trip-status is-${trip.status.toLowerCase()}`}
                  >
                    {statusNames[trip.status] ?? trip.status}
                  </span>
                  <span className="profile-trip-departure">
                    <CalendarDays aria-hidden="true" size={17} />
                    {tripDate(trip.departureAt)}
                  </span>
                </header>
                <div className="profile-trip-route">
                  <span>
                    <MapPin aria-hidden="true" size={19} />
                    <strong>{trip.originLabel}</strong>
                  </span>
                  <i>
                    <ArrowRight aria-hidden="true" size={20} />
                  </i>
                  <span>
                    <MapPin aria-hidden="true" size={19} />
                    <strong>{trip.destinationLabel}</strong>
                  </span>
                </div>
                <footer>
                  <span className="profile-trip-seat">
                    <CarFront aria-hidden="true" size={17} />
                    Còn {trip.remainingSeats}/{trip.offeredSeats} chỗ
                  </span>
                  <Link href={`/trips/${encodeURIComponent(trip.id)}`}>
                    Xem chi tiết <ChevronRight aria-hidden="true" size={17} />
                  </Link>
                </footer>
              </article>
            ))}
          </div>

          {trips.data && trips.data.items.length > recentTrips.length ? (
            <Link className="profile-view-all-trips" href="/trips">
              Xem tất cả chuyến đi <ChevronRight aria-hidden="true" size={17} />
            </Link>
          ) : null}
        </section>
      </div>
    </main>
  );
}
