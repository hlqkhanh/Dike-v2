"use client";

import type { AuthSessionResponse, RidePostView } from "@dike/api-client-ts";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  CarFront,
  Clock3,
  MapPin,
  Search,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { rideApi } from "../../src/rides/api";
import { AppHeader } from "./app-header";
import { DikeLogo } from "./dike-logo";

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
  const list = useInfiniteQuery({
    queryKey: ["feed", "latest"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => rideApi.feed("latest", pageParam),
    getNextPageParam: (last) => last.nextCursor || undefined,
    refetchInterval: 15_000,
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

  const firstName = session.user.displayName.trim().split(/\s+/u).at(-1);

  return (
    <div className="new-home-shell">
      <AppHeader session={session} />
      <main className="new-home-main">
        <section className="new-home-hero" aria-labelledby="home-greeting">
          <div className="new-home-landscape" aria-hidden="true">
            <span className="landscape-sun" />
            <span className="landscape-hill landscape-hill--one" />
            <span className="landscape-hill landscape-hill--two" />
            <span className="landscape-city" />
            <span className="landscape-road" />
          </div>
          <div className="new-home-hero-content">
            <p className="new-home-kicker">Cùng nhau đi xanh hơn mỗi ngày</p>
            <h1 id="home-greeting">
              Chào {firstName || "bạn"}! <span aria-hidden="true">👋</span>
            </h1>
            <p>Tìm một người đồng hành phù hợp cho hành trình tiếp theo.</p>
            <label className="new-home-search">
              <Search aria-hidden="true" size={23} />
              <span className="sr-only">Tìm chuyến đi</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Bạn muốn đi đâu, lúc nào?"
              />
              <MapPin aria-hidden="true" size={22} />
            </label>
          </div>
        </section>

        <section className="new-home-actions" aria-label="Tạo hành trình">
          <Link
            className="journey-cta journey-cta--driver"
            href="/rides/new?mode=driver"
          >
            <span className="journey-cta-icon">
              <CarFront aria-hidden="true" />
            </span>
            <span>
              <small>Bạn có chỗ trống?</small>
              <strong>Tôi chở</strong>
              <em>Đăng chuyến và tìm người đi cùng</em>
            </span>
            <ArrowRight aria-hidden="true" />
          </Link>
          <Link
            className="journey-cta journey-cta--passenger"
            href="/rides/new?mode=passenger"
          >
            <span className="journey-cta-icon">
              <Users aria-hidden="true" />
            </span>
            <span>
              <small>Bạn cần một chuyến đi?</small>
              <strong>Tôi đi ké</strong>
              <em>Tìm tài xế có cùng lộ trình</em>
            </span>
            <ArrowRight aria-hidden="true" />
          </Link>
        </section>

        <section className="new-feed-section" aria-labelledby="feed-heading">
          <div className="new-feed-heading">
            <div>
              <p className="new-home-kicker">Hành trình đang mở</p>
              <h2 id="feed-heading">Bảng feed</h2>
            </div>
            <label className="new-feed-sort">
              <SlidersHorizontal aria-hidden="true" size={16} />
              <span className="sr-only">Sắp xếp</span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as FeedSort)}
              >
                <option value="latest">Mới nhất</option>
                <option value="departure">Sắp khởi hành</option>
              </select>
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
                ["OFFER_RIDE", "Có chỗ trống"],
                ["NEED_RIDE", "Cần người chở"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
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
              <p>Thử đổi từ khóa hoặc bộ lọc, hoặc tạo nhu cầu mới của bạn.</p>
              <Link href="/rides/new?mode=passenger">Tạo nhu cầu đi ké</Link>
            </div>
          ) : (
            <div className="new-feed-grid">
              {posts.map((post) => (
                <HomeRideCard key={post.id} post={post} />
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
        </section>
      </main>
      <footer className="new-home-footer">
        <DikeLogo />
        <p>Chia sẻ một chỗ trống, thêm một hành trình xanh.</p>
      </footer>
    </div>
  );
}

function HomeRideCard({ post }: { post: RidePostView }) {
  const isOffer = post.type === "OFFER_RIDE";
  return (
    <article className="new-ride-card">
      <header>
        <span className="new-ride-avatar" aria-hidden="true">
          DK
        </span>
        <div>
          <strong>Thành viên Diké</strong>
          <small>Hành trình công khai</small>
        </div>
        <span className={`new-ride-kind ${isOffer ? "is-offer" : "is-need"}`}>
          {isOffer ? "Có chỗ trống" : "Cần người chở"}
        </span>
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
        <Link href={`/feed/${encodeURIComponent(post.id)}`}>
          {isOffer ? "Gửi đề nghị" : "Kết nối"}
          <ArrowRight aria-hidden="true" size={15} />
        </Link>
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
