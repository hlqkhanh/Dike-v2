"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  CarFront,
  ChevronRight,
  Clock3,
  Facebook,
  Mail,
  MapPin,
  Phone,
  Plus,
  Settings,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { profileApi } from "../../src/profile/api";
import { authApi } from "../../src/auth/api";
import { rideApi } from "../../src/rides/api";
import { socialApi } from "../../src/social/api";
import { EmptyState, ErrorState, LoadingState } from "../components/app-ui";
import { MemberAvatar } from "../components/member-avatar";
import { FeedRoutePreview } from "../../src/rides/feed-route-preview";

const initials = (name: string) =>
  name
    .split(/\s+/u)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

export default function ProfileHubPage() {
  const profile = useQuery({
    queryKey: ["profile", "me"],
    queryFn: profileApi.myProfile,
  });
  const session = useQuery({
    queryKey: ["auth", "session"],
    queryFn: authApi.session,
  });
  const posts = useQuery({
    queryKey: ["rides", "posts", "profile-preview"],
    queryFn: () => rideApi.feed("mine"),
  });
  const friends = useQuery({
    queryKey: ["social", "profile-preview", "friends"],
    queryFn: () => socialApi.list("friends"),
  });

  const displayName = profile.data?.displayName ?? "Thành viên Diké";
  const recentPosts = posts.data?.items.slice(0, 5) ?? [];
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

          {posts.isPending ? <LoadingState label="Đang tải chuyến đi" /> : null}
          {posts.isError ? (
            <ErrorState
              message="Không thể tải chuyến đi của bạn."
              onRetry={() => void posts.refetch()}
            />
          ) : null}
          {!posts.isPending && !posts.isError && recentPosts.length === 0 ? (
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

          <div className="profile-feed-list">
            {recentPosts.map((post) => {
              const isOffer = post.type === "OFFER_RIDE";
              return (
                <article
                  className={`new-ride-card ${isOffer ? "is-offer" : "is-need"}`}
                  key={post.id}
                >
                  <Link
                    className="new-ride-card-link"
                    href={`/feed/${encodeURIComponent(post.id)}`}
                    aria-label={`Xem chi tiết hành trình ${post.originLabel} đến ${post.destinationLabel}`}
                  />
                  <div className="new-ride-content">
                    <div className="new-ride-information">
                      <header>
                        <MemberAvatar
                          name={post.ownerDisplayName || displayName}
                          avatarUrl={post.ownerAvatarUrl}
                          className="new-ride-avatar"
                          size={42}
                        />
                        <div>
                          <strong>
                            {post.ownerDisplayName || displayName}
                          </strong>
                          <small>Hành trình công khai</small>
                        </div>
                        <span className="new-ride-owned">Bài của bạn</span>
                        <span
                          className={`new-ride-kind ${isOffer ? "is-offer" : "is-need"}`}
                        >
                          {isOffer ? "Tôi chở" : "Tôi đi ké"}
                        </span>
                      </header>
                      <div className="new-ride-route">
                        <span aria-hidden="true">
                          <i />
                          <b />
                          <i />
                        </span>
                        <div>
                          <small>Điểm đi</small>
                          <strong>{post.originLabel}</strong>
                          <small>Điểm đến</small>
                          <strong>{post.destinationLabel}</strong>
                        </div>
                      </div>
                      <div className="new-ride-meta">
                        <span>
                          <CalendarDays aria-hidden="true" size={15} />
                          {new Date(post.departureAt).toLocaleDateString(
                            "vi-VN",
                          )}
                        </span>
                        <span>
                          <Clock3 aria-hidden="true" size={15} />
                          {new Date(post.departureAt).toLocaleTimeString(
                            "vi-VN",
                            { hour: "2-digit", minute: "2-digit" },
                          )}
                        </span>
                        <span>
                          <CarFront aria-hidden="true" size={15} />
                          {post.vehicleType === "MOTORCYCLE"
                            ? "Xe máy"
                            : "Ô tô"}
                        </span>
                      </div>
                      {post.note ? (
                        <p className="new-ride-note">{post.note}</p>
                      ) : null}
                      <div className="new-ride-stats">
                        <span>
                          <CarFront aria-hidden="true" size={15} />
                          {isOffer
                            ? `Còn ${post.remainingSeats} chỗ`
                            : "Đang tìm đồng hành"}
                        </span>
                        <span>
                          <Users aria-hidden="true" size={15} />
                          {post.pendingResponseCount ?? 0} yêu cầu
                        </span>
                      </div>
                    </div>
                    <div className="new-ride-map-column">
                      <FeedRoutePreview
                        id={post.id}
                        origin={post.originLabel}
                        destination={post.destinationLabel}
                      />
                      <footer>
                        <span className="new-ride-request-count">
                          <Users aria-hidden="true" size={15} />
                          Xem {post.pendingResponseCount ?? 0} yêu cầu
                          <ChevronRight aria-hidden="true" size={15} />
                        </span>
                      </footer>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {posts.data && posts.data.items.length > recentPosts.length ? (
            <Link className="profile-view-all-trips" href="/home">
              Xem tất cả bài đăng <ChevronRight aria-hidden="true" size={17} />
            </Link>
          ) : null}
        </section>
      </div>
    </main>
  );
}
