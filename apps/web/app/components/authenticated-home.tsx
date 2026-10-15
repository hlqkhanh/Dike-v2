"use client";

import type { AuthSessionResponse, RidePostView } from "@dike/api-client-ts";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  CarFront,
  ChevronDown,
  Clock3,
  EyeOff,
  Flag,
  Globe2,
  MapPin,
  MoreHorizontal,
  Search,
  Send,
  Trash2,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { rideApi } from "../../src/rides/api";
import { AppHeader } from "./app-header";
import { DikeLogo } from "./dike-logo";
import { MemberAvatar } from "./member-avatar";
import { PassengerRequest } from "../../src/rides/passenger-request";
import { FeedRoutePreview } from "../../src/rides/feed-route-preview";

type FeedFilter = "ALL" | "OFFER_RIDE" | "NEED_RIDE";
type FeedSort = "latest" | "oldest";

export function AuthenticatedHome({
  session,
}: {
  session: AuthSessionResponse;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FeedFilter>("ALL");
  const [sort, setSort] = useState<FeedSort>("latest");
  const [departureDate, setDepartureDate] = useState("");
  const [sortOpen, setSortOpen] = useState(false);
  const [hiddenPostIds, setHiddenPostIds] = useState<string[]>([]);
  const [reportPost, setReportPost] = useState<RidePostView | null>(null);
  const [reportReason, setReportReason] = useState("UNSAFE");
  const [reportNote, setReportNote] = useState("");
  const sortMenu = useRef<HTMLDivElement>(null);
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
  const removeMutation = useMutation({
    mutationFn: (post: RidePostView) =>
      rideApi.postAction(post.id, "close", post.version, crypto.randomUUID()),
    onSuccess: (_result, post) => {
      hidePost(post.id);
      void list.refetch();
    },
  });
  const reportMutation = useMutation({
    mutationFn: (post: RidePostView) =>
      rideApi.report(
        {
          postId: post.id,
          reason: reportReason,
          note: reportNote.trim() || undefined,
        },
        crypto.randomUUID(),
      ),
    onSuccess: () => {
      setReportNote("");
    },
  });

  const hidePost = (postId: string) => {
    setHiddenPostIds((current) => {
      const next = current.includes(postId) ? current : [...current, postId];
      window.localStorage.setItem(
        "dike-hidden-feed-posts",
        JSON.stringify(next),
      );
      return next;
    });
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Hydrate controls from the address bar once; subsequent changes sync back below.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(params.get("q") ?? "");
    const type = params.get("type");
    if (type === "OFFER_RIDE" || type === "NEED_RIDE") setFilter(type);
    if (params.get("sort") === "oldest") setSort("oldest");
    setDepartureDate(params.get("departure") ?? "");
    try {
      const stored = JSON.parse(
        window.localStorage.getItem("dike-hidden-feed-posts") ?? "[]",
      );
      if (Array.isArray(stored))
        setHiddenPostIds(stored.filter((item) => typeof item === "string"));
    } catch {
      window.localStorage.removeItem("dike-hidden-feed-posts");
    }
    setUrlReady(true);
  }, []);

  useEffect(() => {
    if (!sortOpen) return;
    const close = (event: PointerEvent) => {
      if (!sortMenu.current?.contains(event.target as Node)) setSortOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSortOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [sortOpen]);

  useEffect(() => {
    if (!urlReady) return;
    const params = new URLSearchParams(window.location.search);
    if (query.trim()) params.set("q", query.trim());
    else params.delete("q");
    if (filter === "ALL") params.delete("type");
    else params.set("type", filter);
    if (sort === "latest") params.delete("sort");
    else params.set("sort", sort);
    if (departureDate) params.set("departure", departureDate);
    else params.delete("departure");
    const next = `${window.location.pathname}${params.size ? `?${params}` : ""}`;
    window.history.replaceState(null, "", next);
  }, [departureDate, filter, query, sort, urlReady]);

  const posts = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("vi");
    const values = (
      list.data?.pages.flatMap((page) => page.items) ?? []
    ).filter(
      (post) =>
        post.status === "OPEN" &&
        !hiddenPostIds.includes(post.id) &&
        (filter === "ALL" || post.type === filter) &&
        (!departureDate || localDateKey(post.departureAt) === departureDate) &&
        (!needle ||
          `${post.originLabel} ${post.destinationLabel} ${post.note}`
            .toLocaleLowerCase("vi")
            .includes(needle)),
    );
    return sort === "oldest" ? [...values].reverse() : values;
  }, [departureDate, filter, hiddenPostIds, list.data, query, sort]);

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
            </div>
            <div className="new-feed-toolbar">
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
              <div className="new-feed-controls">
                <label className="new-feed-date">
                  <CalendarDays aria-hidden="true" size={17} />
                  <span>
                    <strong>Ngày khởi hành</strong>
                    <small>
                      {departureDate
                        ? new Date(
                            `${departureDate}T00:00:00`,
                          ).toLocaleDateString("vi-VN")
                        : "Chọn ngày"}
                    </small>
                  </span>
                  <input
                    type="date"
                    aria-label="Lọc theo ngày khởi hành"
                    value={departureDate}
                    onChange={(event) => setDepartureDate(event.target.value)}
                  />
                  <ChevronDown aria-hidden="true" size={15} />
                </label>
                <div className="new-feed-sort" ref={sortMenu}>
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={sortOpen}
                    onClick={() => setSortOpen((open) => !open)}
                  >
                    <span aria-hidden="true">↕</span>
                    {sort === "latest" ? "Mới nhất" : "Cũ nhất"}
                    <ChevronDown aria-hidden="true" size={15} />
                  </button>
                  {sortOpen ? (
                    <div className="new-feed-sort-menu" role="menu">
                      {(
                        [
                          ["latest", "Mới nhất"],
                          ["oldest", "Cũ nhất"],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          type="button"
                          role="menuitemradio"
                          aria-checked={sort === value}
                          key={value}
                          onClick={() => {
                            setSort(value);
                            setSortOpen(false);
                          }}
                        >
                          {label}
                          {sort === value ? <span>✓</span> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            {removeMutation.isError ? (
              <p className="new-feed-action-error" role="alert">
                Chưa thể xóa bài đăng. Dữ liệu có thể vừa được cập nhật, vui
                lòng tải lại và thử lại.
              </p>
            ) : null}

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
                    onHide={() => hidePost(post.id)}
                    onDelete={() => removeMutation.mutate(post)}
                    onReport={() => {
                      reportMutation.reset();
                      setReportReason("UNSAFE");
                      setReportNote("");
                      setReportPost(post);
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
      {reportPost ? (
        <div
          className="home-response-modal home-report-modal"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !reportMutation.isPending
            )
              setReportPost(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="home-report-title"
          >
            <button
              className="home-response-close"
              type="button"
              aria-label="Đóng báo cáo"
              onClick={() => setReportPost(null)}
            >
              <X aria-hidden="true" size={22} />
            </button>
            <div className="home-response-heading">
              <span aria-hidden="true">
                <Flag size={26} />
              </span>
              <div>
                <h2 id="home-report-title">Báo cáo bài đăng</h2>
              </div>
            </div>
            {reportMutation.isSuccess ? (
              <div className="home-report-success" role="status">
                <strong>Đã tiếp nhận báo cáo</strong>
                <p>Đội ngũ Diké sẽ kiểm tra nội dung này.</p>
              </div>
            ) : (
              <div className="home-report-form">
                <label>
                  <span>Lý do báo cáo</span>
                  <select
                    value={reportReason}
                    onChange={(event) => setReportReason(event.target.value)}
                  >
                    <option value="UNSAFE">Không an toàn</option>
                    <option value="SPAM">Spam hoặc quảng cáo</option>
                    <option value="MISLEADING">Thông tin sai lệch</option>
                    <option value="OTHER">Lý do khác</option>
                  </select>
                </label>
                <label>
                  <span>Mô tả thêm</span>
                  <textarea
                    maxLength={500}
                    value={reportNote}
                    onChange={(event) => setReportNote(event.target.value)}
                    placeholder="Mô tả ngắn vấn đề bạn nhận thấy"
                  />
                </label>
                {reportMutation.isError ? (
                  <p role="alert">Chưa thể gửi báo cáo.</p>
                ) : null}
              </div>
            )}
            <div className="home-response-actions">
              <button type="button" onClick={() => setReportPost(null)}>
                {reportMutation.isSuccess ? "Đóng" : "Hủy"}
              </button>
              {!reportMutation.isSuccess ? (
                <button
                  type="button"
                  className="is-submit"
                  disabled={reportMutation.isPending}
                  onClick={() => reportMutation.mutate(reportPost)}
                >
                  <Flag aria-hidden="true" size={18} />
                  {reportMutation.isPending ? "Đang gửi…" : "Gửi báo cáo"}
                </button>
              ) : null}
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
  onHide,
  onDelete,
  onReport,
}: {
  post: RidePostView;
  currentUserId: string;
  onRespond: (post: RidePostView) => void;
  onHide: () => void;
  onDelete: () => void;
  onReport: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const isOffer = post.type === "OFFER_RIDE";
  const owner = post.ownerId === currentUserId;
  const ownerName = post.ownerDisplayName || "Thành viên Diké";
  const requestCount = post.pendingResponseCount ?? 0;
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuOpen]);
  return (
    <article className={`new-ride-card ${isOffer ? "is-offer" : "is-need"}`}>
      <Link
        className="new-ride-card-link"
        href={`/feed/${encodeURIComponent(post.id)}`}
        aria-label={`Xem chi tiết hành trình của ${ownerName}`}
      />
      <div className="new-ride-content">
        <div className="new-ride-information">
          <header>
            <MemberAvatar
              name={ownerName}
              avatarUrl={post.ownerAvatarUrl}
              className="new-ride-avatar"
              size={42}
            />
            <div>
              <strong>{ownerName}</strong>
              <small>
                Hành trình công khai
                <Globe2 aria-hidden="true" size={12} />
              </small>
            </div>
            <span
              className={`new-ride-kind ${isOffer ? "is-offer" : "is-need"}`}
            >
              <CarFront aria-hidden="true" size={15} />
              {isOffer ? "Tôi chở" : "Tôi đi ké"}
            </span>
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
              <small>Điểm đi</small>
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
          <div className="new-ride-stats">
            <span>
              <CarFront aria-hidden="true" size={15} />
              {isOffer && typeof post.remainingSeats === "number"
                ? `Còn ${post.remainingSeats} chỗ`
                : "Đang tìm đồng hành"}
            </span>
            <span>
              <Users aria-hidden="true" size={15} />
              {requestCount} yêu cầu
            </span>
          </div>
        </div>
        <div className="new-ride-map-column">
          <div className="new-ride-menu" ref={menu}>
            <button
              className="new-ride-more"
              type="button"
              aria-label="Mở tùy chọn bài đăng"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <MoreHorizontal aria-hidden="true" size={19} />
            </button>
            {menuOpen ? (
              <div className="new-ride-dropdown" role="menu">
                {owner ? (
                  <>
                    <button type="button" role="menuitem" onClick={onHide}>
                      <EyeOff aria-hidden="true" size={17} /> Ẩn khỏi bảng feed
                    </button>
                    <button
                      className="is-danger"
                      type="button"
                      role="menuitem"
                      onClick={onDelete}
                    >
                      <Trash2 aria-hidden="true" size={17} /> Xóa bài đăng
                    </button>
                  </>
                ) : null}
                <button type="button" role="menuitem" onClick={onReport}>
                  <Flag aria-hidden="true" size={17} /> Báo cáo bài đăng
                </button>
              </div>
            ) : null}
          </div>
          <FeedRoutePreview
            id={post.id}
            origin={post.originLabel}
            destination={post.destinationLabel}
          />
          <footer>
            {owner ? (
              <span className="new-ride-request-count">
                <Users aria-hidden="true" size={15} />
                Xem {requestCount} yêu cầu
                <ArrowRight aria-hidden="true" size={15} />
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
        </div>
      </div>
    </article>
  );
}

function localDateKey(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
