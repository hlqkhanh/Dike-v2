"use client";

import { use, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  CarFront,
  ChevronRight,
  MapPin,
  MessageCircle,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ErrorState, LoadingState } from "../../components/app-ui";
import { journeyApi } from "../../../src/journey/api";
import { profileApi } from "../../../src/profile/api";
import { rideApi } from "../../../src/rides/api";
import { ProfileSocialActions } from "../../../src/social/actions";
import { ReportDialog } from "../../../src/trust/report-dialog";

const initials = (name: string) =>
  name
    .split(/\s+/u)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
const dateTime = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
const statusNames: Record<string, string> = {
  OPEN: "Đang mở",
  MATCHED: "Đã ghép",
  FULL: "Đủ chỗ",
  IN_PROGRESS: "Đang đi",
  COMPLETED: "Hoàn tất",
  CLOSED: "Đã đóng",
  CANCELLED: "Đã hủy",
  EXPIRED: "Hết hạn",
};

export default function PublicProfileDashboard({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = use(params);
  const router = useRouter();
  const [messageError, setMessageError] = useState("");
  const profile = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => profileApi.userProfile(userId),
    retry: false,
  });
  const posts = useQuery({
    queryKey: ["profile", userId, "public-posts"],
    queryFn: () => rideApi.feed("all"),
  });
  const message = useMutation({
    mutationFn: () => journeyApi.direct(userId),
    onMutate: () => setMessageError(""),
    onSuccess: (conversation) =>
      router.push(
        `/friends?conversation=${encodeURIComponent(conversation.id)}`,
      ),
    onError: (error) => setMessageError(error.message),
  });
  const publicPosts = (posts.data?.items ?? [])
    .filter((post) => post.ownerId === userId && post.status !== "DRAFT")
    .slice(0, 5);

  if (profile.isPending)
    return (
      <main className="profile-dashboard">
        <LoadingState label="Đang tải hồ sơ" />
      </main>
    );
  if (profile.isError)
    return (
      <main className="profile-dashboard">
        <ErrorState
          title="Không tìm thấy hồ sơ"
          message="Hồ sơ không tồn tại hoặc chủ tài khoản không chia sẻ thông tin này."
          onRetry={() => void profile.refetch()}
        />
      </main>
    );

  const person = profile.data;
  return (
    <main className="profile-dashboard public-profile-dashboard">
      <section className="profile-dashboard-banner">
        <div className="profile-dashboard-avatar">
          {person.avatarUrl ? (
            <Image
              unoptimized
              src={person.avatarUrl}
              width={108}
              height={108}
              alt={`Ảnh đại diện của ${person.displayName}`}
            />
          ) : (
            <span>{initials(person.displayName) || "DK"}</span>
          )}
        </div>
        <div className="profile-dashboard-identity">
          <p>Hồ sơ Diké Share</p>
          <h1>{person.displayName}</h1>
          <span>
            {person.bio || "Cùng cộng đồng tạo nên những hành trình xanh hơn."}
          </span>
          <div className="public-profile-dashboard-actions">
            <button
              className="profile-settings-button"
              type="button"
              disabled={message.isPending}
              onClick={() => message.mutate()}
            >
              <MessageCircle aria-hidden="true" size={16} />{" "}
              {message.isPending ? "Đang mở…" : "Nhắn tin"}
            </button>
            <ProfileSocialActions userId={userId} />
            <ReportDialog targetType="USER" targetId={userId} />
          </div>
          {messageError ? (
            <p className="public-profile-dashboard-error" role="alert">
              {messageError}
            </p>
          ) : null}
        </div>
      </section>

      <div className="profile-dashboard-grid">
        <aside className="profile-dashboard-sidebar">
          <section className="profile-info-panel">
            <header>
              <h2>Thông tin thành viên</h2>
            </header>
            <div className="profile-info-row">
              {person.verified ? (
                <ShieldCheck aria-hidden="true" />
              ) : (
                <UserRound aria-hidden="true" />
              )}
              <div>
                <small>Trạng thái tài khoản</small>
                <strong>
                  {person.verified
                    ? "Thành viên đã xác minh"
                    : "Thành viên Diké"}
                </strong>
              </div>
            </div>
            <div className="profile-info-row">
              <MessageCircle aria-hidden="true" />
              <div>
                <small>Giới thiệu</small>
                <strong>{person.bio || "Chưa thêm phần giới thiệu."}</strong>
              </div>
            </div>
          </section>
          <section className="profile-friends-panel public-profile-trust-panel">
            <header>
              <h2>Kết nối an toàn</h2>
            </header>
            <p>
              Trao đổi trong Diké và chỉ chia sẻ thông tin chuyến đi sau khi hai
              bên xác nhận.
            </p>
          </section>
        </aside>

        <section className="profile-trips-panel">
          <header className="profile-trips-heading">
            <div>
              <p>Hành trình công khai</p>
              <h2>Chuyến đi đã đăng</h2>
            </div>
          </header>
          {posts.isPending ? <LoadingState label="Đang tải chuyến đi" /> : null}
          {posts.isError ? (
            <p className="profile-inline-error">
              Chưa thể tải chuyến đi công khai.
            </p>
          ) : null}
          {!posts.isPending && !posts.isError && publicPosts.length === 0 ? (
            <div className="public-profile-empty-posts">
              <CarFront aria-hidden="true" />
              <strong>Chưa có chuyến đi công khai</strong>
              <span>
                Các hành trình mới của thành viên sẽ xuất hiện tại đây.
              </span>
            </div>
          ) : null}
          <div className="profile-trip-list">
            {publicPosts.map((post) => (
              <article className="profile-trip-card" key={post.id}>
                <header>
                  <span
                    className={`profile-trip-status is-${post.status.toLowerCase()}`}
                  >
                    {statusNames[post.status] ?? post.status}
                  </span>
                  <span className="profile-trip-departure">
                    <CalendarDays aria-hidden="true" size={17} />
                    {dateTime(post.departureAt)}
                  </span>
                </header>
                <div className="profile-trip-route">
                  <span>
                    <MapPin aria-hidden="true" size={19} />
                    <strong>{post.originLabel}</strong>
                  </span>
                  <i>
                    <ArrowRight aria-hidden="true" size={20} />
                  </i>
                  <span>
                    <MapPin aria-hidden="true" size={19} />
                    <strong>{post.destinationLabel}</strong>
                  </span>
                </div>
                <footer>
                  <span className="profile-trip-seat">
                    <CarFront aria-hidden="true" size={17} />
                    {post.type === "OFFER_RIDE"
                      ? `Còn ${post.remainingSeats} chỗ`
                      : "Đang tìm người đồng hành"}
                  </span>
                  <Link href={`/feed/${encodeURIComponent(post.id)}`}>
                    Xem chi tiết <ChevronRight aria-hidden="true" size={17} />
                  </Link>
                </footer>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
