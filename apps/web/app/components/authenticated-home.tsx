"use client";

import type { AuthSessionResponse, RidePostView } from "@dike/api-client-ts";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  CarFront,
  ChevronDown,
  Clock3,
  MapPin,
  Search,
  Send,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { rideApi } from "../../src/rides/api";
import { AppHeader } from "./app-header";
import { DikeLogo } from "./dike-logo";
import { MemberAvatar } from "./member-avatar";
import { PassengerRequest } from "../../src/rides/passenger-request";

type FeedFilter = "ALL" | "OFFER_RIDE" | "NEED_RIDE";
type FeedSort = "latest" | "departure";

export function AuthenticatedHome({
  session,
}: {
  session: AuthSessionResponse;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FeedFilter>("ALL");
  const [sort, setSort] = useState<FeedSort>("latest");
  const [urlReady, setUrlReady] = useState(false);
  const [feedScrolled, setFeedScrolled] = useState(false);
  const [cardsHidden, setCardsHidden] = useState(false);
  const [responsePost, setResponsePost] = useState<RidePostView | null>(null);
  const [responseMessage, setResponseMessage] = useState("");
  const list = useInfiniteQuery({
    queryKey: ["feed", "latest"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => rideApi.feed("latest", pageParam),
    getNextPageParam: (last) => last.nextCursor || undefined,
    refetchInterval: 15_000,
  });
  const responseMutation = useMutation({
    mutationFn: ({ postId, message }: { postId: string; message: string }) =>
      rideApi.createPostResponse(postId, message),
    onSuccess: () => {
      setResponsePost(null);
      setResponseMessage("");
      void list.refetch();
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Hydrate controls from the address bar once; subsequent changes sync back below.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(params.get("q") ?? "");
    const type = params.get("type");
    if (type === "OFFER_RIDE" || type === "NEED_RIDE") setFilter(type);
    if (params.get("sort") === "departure") setSort("departure");
    setUrlReady(true);
  }, []);

  useEffect(() => {
    if (!urlReady) return;
    const params = new URLSearchParams(window.location.search);
    if (query.trim()) params.set("q", query.trim());
    else params.delete("q");
    if (filter === "ALL") params.delete("type");
    else params.set("type", filter);
    if (sort === "latest") params.delete("sort");
    else params.set("sort", sort);
    const next = `${window.location.pathname}${params.size ? `?${params}` : ""}`;
    window.history.replaceState(null, "", next);
  }, [filter, query, sort, urlReady]);

  const posts = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("vi");
    const values = (
      list.data?.pages.flatMap((page) => page.items) ?? []
    ).filter(
      (post) =>
        post.status === "OPEN" &&
        (filter === "ALL" || post.type === filter) &&
        (!needle ||
          `${post.originLabel} ${post.destinationLabel} ${post.note}`
            .toLocaleLowerCase("vi")
            .includes(needle)),
    );
    return sort === "departure"
      ? [...values].sort(
          (a: RidePostView, b: RidePostView) =>
            new Date(a.departureAt).getTime() -
            new Date(b.departureAt).getTime(),
        )
      : values;
  }, [filter, list.data, query, sort]);

  return (
    <div className="new-home-shell">
      <div className="new-home-bg-layer" aria-hidden="true" />
      <AppHeader session={session} scrollState={feedScrolled} />
      <main
        className="new-home-main"
        tabIndex={0}
        aria-label="Trang chủ Diké"
        onScroll={(event) => {
          const scrollArea = event.currentTarget;
          const y = scrollArea.scrollTop;
          const progress = Math.min(1, Math.max(0, y / 180));
          const fly = Math.min(1, Math.max(0, (y - 35) / 145));
          const fadeProgress = Math.min(1, Math.max(0, (y - 100) / 80));
          const fade = fadeProgress * fadeProgress * (3 - 2 * fadeProgress);
          scrollArea.style.setProperty(
            "--home-cards-progress",
            String(progress),
          );
          scrollArea.style.setProperty("--home-cards-fly", String(fly));
          scrollArea.style.setProperty(
            "--home-cards-opacity",
            String(1 - fade),
          );
          setFeedScrolled(y > 30);
          setCardsHidden(progress === 1);
        }}
      >
        <section className="new-home-hero" aria-labelledby="home-greeting">
          <div className="new-home-hero-content">
            <h1 id="home-greeting" className="new-home-hero-title">
              Chào bạn! <span aria-hidden="true">👋</span>
            </h1>
            <p className="new-home-hero-sub">Cùng Diké đi xa hơn mỗi ngày</p>

            <label className="new-home-search">
              <Search
                aria-hidden="true"
                size={20}
                className="new-home-search-lens"
              />
              <span className="sr-only">Tìm chuyến đi</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Bạn muốn đi đâu, ăn gì?"
              />
              <span className="new-home-search-sep" aria-hidden="true">
                ⊹
              </span>
              <button
                type="button"
                className="new-home-search-pin-btn"
                aria-label="Định vị điểm đến"
              >
                <MapPin aria-hidden="true" size={17} />
              </button>
            </label>
          </div>
        </section>

        <section className="new-feed-section" aria-labelledby="feed-heading">
          <div
            className="new-home-cards-row"
            aria-hidden={cardsHidden || undefined}
            inert={cardsHidden}
          >
            <Link
              className="home-feature-card home-feature-card--car"
              href="/rides/new?mode=driver"
            >
              <div className="feature-card-content">
                <strong>Tôi chở</strong>
              </div>
            </Link>

            <Link
              className="home-feature-card home-feature-card--scooter"
              href="/rides/new?mode=passenger"
            >
              <div className="feature-card-content">
                <strong>Tôi đi ké</strong>
              </div>
            </Link>
          </div>
          <div className="new-feed-container">
            <div className="new-feed-heading">
              <div>
                <h2 id="feed-heading">Bảng feed</h2>
                <p className="new-feed-subtitle">
                  Những chuyến đi đang chờ bạn
                </p>
              </div>
              <label className="new-feed-sort">
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as FeedSort)}
                >
                  <option value="latest">Mới nhất</option>
                  <option value="departure">Sắp khởi hành</option>
                </select>
                <ChevronDown aria-hidden="true" size={15} />
              </label>
            </div>
            <div
              className="new-feed-filters"
              role="group"
              aria-label="Lọc bài đăng"
            >
              {(
                [
                  ["ALL", "Tất cả"],
                  ["OFFER_RIDE", "Tôi chở"],
                  ["NEED_RIDE", "Tôi đi ké"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  data-ride-type={value}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            {list.isPending ? (
              <FeedSkeleton />
            ) : list.isError ? (
              <div className="new-feed-state" role="alert">
                <h3>Chưa thể tải bảng feed</h3>
                <p>{list.error.message}</p>
                <button type="button" onClick={() => void list.refetch()}>
                  Thử lại
                </button>
              </div>
            ) : posts.length === 0 ? (
              <div className="new-feed-state">
                <span>🌿</span>
                <h3>Chưa tìm thấy hành trình phù hợp</h3>
                <p>
                  Thử đổi từ khóa hoặc bộ lọc, hoặc tạo nhu cầu mới của bạn.
                </p>
                <Link href="/rides/new?mode=passenger">Tạo nhu cầu đi ké</Link>
              </div>
            ) : (
              <div className="new-feed-grid">
                {posts.map((post) => (
                  <HomeRideCard
                    key={post.id}
                    post={post}
                    currentUserId={session.user.id}
                    onRespond={(selected) => {
                      responseMutation.reset();
                      setResponseMessage("");
                      setResponsePost(selected);
                    }}
                  />
                ))}
              </div>
            )}
            {list.hasNextPage ? (
              <button
                className="new-feed-more"
                type="button"
                disabled={list.isFetchingNextPage}
                onClick={() => void list.fetchNextPage()}
              >
                {list.isFetchingNextPage ? "Đang tải…" : "Xem thêm hành trình"}
              </button>
            ) : null}
          </div>
        </section>
        <footer className="new-home-footer">
          <DikeLogo />
          <p>Chia sẻ một chỗ trống, thêm một hành trình xanh.</p>
        </footer>
      </main>
      {responsePost?.type === "OFFER_RIDE" ? (
        <PassengerRequest
          key={responsePost.id}
          post={responsePost}
          onClose={() => setResponsePost(null)}
          onSent={() => void list.refetch()}
        />
      ) : responsePost ? (
        <div
          className="home-response-modal"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !responseMutation.isPending
            )
              setResponsePost(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="home-response-title"
          >
            <button
              className="home-response-close"
              type="button"
              aria-label="Đóng"
              disabled={responseMutation.isPending}
              onClick={() => setResponsePost(null)}
            >
              <X aria-hidden="true" size={24} />
            </button>
            <div className="home-response-heading">
              <span aria-hidden="true">
                <Send size={28} />
              </span>
              <div>
                <h2 id="home-response-title">
                  {responsePost.type === "OFFER_RIDE"
                    ? "Gửi yêu cầu đi ké?"
                    : "Gửi đề nghị chở?"}
                </h2>
              </div>
            </div>
            <p className="home-response-description">
              Yêu cầu sẽ được gửi tới người đăng. Chỉ sau khi họ xác nhận, hai
              bên mới tiếp tục trao đổi thông tin chuyến đi.
            </p>
            <div className="home-response-route">
              <span className="home-response-route-line" aria-hidden="true">
                <i />
                <b />
                <i />
              </span>
              <div>
                <strong>{responsePost.originLabel}</strong>
                <strong>{responsePost.destinationLabel}</strong>
                <div className="home-response-departure">
                  <CalendarDays aria-hidden="true" size={22} />
                  <span>
                    <small>Khởi hành</small>
                    <strong>
                      {new Date(responsePost.departureAt).toLocaleString(
                        "vi-VN",
                      )}
                    </strong>
                  </span>
                </div>
              </div>
            </div>
            <label className="home-response-message">
              <span>
                <strong>Lời nhắn cho tác giả</strong> (không bắt buộc)
                <small>{responseMessage.length}/300</small>
              </span>
              <textarea
                autoFocus
                maxLength={300}
                value={responseMessage}
                onChange={(event) => setResponseMessage(event.target.value)}
                placeholder="Ví dụ: Mình có thể đi nhé! Bạn cho mình biết thêm thông tin điểm đón cụ thể được không?"
              />
            </label>
            {responseMutation.isError ? (
              <p className="home-response-error" role="alert">
                {responseMutation.error.message}
              </p>
            ) : null}
            <div className="home-response-actions">
              <button
                type="button"
                disabled={responseMutation.isPending}
                onClick={() => setResponsePost(null)}
              >
                Quay lại
              </button>
              <button
                type="button"
                className="is-submit"
                disabled={responseMutation.isPending}
                onClick={() =>
                  responseMutation.mutate({
                    postId: responsePost.id,
                    message: responseMessage,
                  })
                }
              >
                <Send aria-hidden="true" size={19} />
                {responseMutation.isPending ? "Đang gửi…" : "Gửi yêu cầu"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function HomeRideCard({
  post,
  currentUserId,
  onRespond,
}: {
  post: RidePostView;
  currentUserId: string;
  onRespond: (post: RidePostView) => void;
}) {
  const isOffer = post.type === "OFFER_RIDE";
  const owner = post.ownerId === currentUserId;
  const ownerName = post.ownerDisplayName || "Thành viên Diké";
  return (
    <article className={`new-ride-card ${isOffer ? "is-offer" : "is-need"}`}>
      <Link
        className="new-ride-card-link"
        href={`/feed/${encodeURIComponent(post.id)}`}
        aria-label={`Xem chi tiết hành trình của ${ownerName}`}
      />
      <header>
        <MemberAvatar
          name={ownerName}
          avatarUrl={post.ownerAvatarUrl}
          className="new-ride-avatar"
          size={38}
        />
        <div>
          <strong>{ownerName}</strong>
        </div>
        {post.id.startsWith("demo-") || post.id.startsWith("demo:") ? (
          <span className="new-ride-owned">Bài mẫu</span>
        ) : owner ? (
          <span className="new-ride-owned">Bài của bạn</span>
        ) : null}
      </header>
      <div className="new-ride-route">
        <span aria-hidden="true">
          <i />
          <b />
          <i />
        </span>
        <div>
          <small>Điểm đón</small>
          <strong>{post.originLabel}</strong>
          <small>Điểm đến</small>
          <strong>{post.destinationLabel}</strong>
        </div>
      </div>
      <div className="new-ride-meta">
        <span>
          <CalendarDays aria-hidden="true" size={15} />
          {new Date(post.departureAt).toLocaleDateString("vi-VN")}
        </span>
        <span>
          <Clock3 aria-hidden="true" size={15} />
          {new Date(post.departureAt).toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        <span>
          <CarFront aria-hidden="true" size={15} />
          {post.vehicleType === "MOTORCYCLE" ? "Xe máy" : "Ô tô"}
        </span>
      </div>
      {post.note ? <p className="new-ride-note">{post.note}</p> : null}
      <footer>
        <span>
          {isOffer && typeof post.remainingSeats === "number"
            ? `Còn ${post.remainingSeats} chỗ`
            : "Đang tìm đồng hành"}
        </span>
        {owner ? (
          <span className="new-ride-request-count">
            <Users aria-hidden="true" size={15} />
            {post.pendingResponseCount} yêu cầu
          </span>
        ) : (
          <button
            className="new-ride-response-link"
            type="button"
            onClick={() => onRespond(post)}
          >
            {isOffer ? "Đi ké ngay" : "Chở ngay"}
            <ArrowRight aria-hidden="true" size={15} />
          </button>
        )}
      </footer>
    </article>
  );
}

function FeedSkeleton() {
  return (
    <div className="new-feed-grid" aria-label="Đang tải bảng feed">
      {[0, 1, 2].map((item) => (
        <div className="new-ride-card new-ride-card--skeleton" key={item}>
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}
