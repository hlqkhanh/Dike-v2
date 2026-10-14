"use client";
import { MemberAvatar } from "../../app/components/member-avatar";

import Link from "next/link";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRef, useState, type ReactNode } from "react";
import type {
  BookingView,
  ProposalView,
  RidePostView,
  TripView,
} from "@dike/api-client-ts";
import {
  ArrowRight,
  Bookmark,
  CalendarClock,
  CarFront,
  Check,
  Clock3,
  Coins,
  Grid2X2,
  Handshake,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Route,
  Search,
  Send,
  Sparkles,
  TicketCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "../../app/components/app-ui";
import { authApi } from "../auth/api";
import { useAuthFailure } from "../auth/use-auth-failure";
import { rideApi } from "./api";

const names: Record<string, string> = {
  DRAFT: "Bản nháp",
  OPEN: "Đang mở",
  MATCHED: "Đã ghép",
  CLOSED: "Đã đóng",
  EXPIRED: "Hết hạn",
  CANCELLED: "Đã hủy",
  FULL: "Đủ chỗ",
  IN_PROGRESS: "Đang đi",
  COMPLETED: "Hoàn tất",
  PENDING: "Chờ phản hồi",
  ACCEPTED: "Đã nhận",
  REJECTED: "Đã từ chối",
  WITHDRAWN: "Đã rút",
  CONFIRMED: "Đã xác nhận",
  DRIVER_ARRIVED: "Tài xế đã đến",
  BOARDED: "Đã lên xe",
  NO_SHOW: "Không có mặt",
  ENDED_EARLY: "Kết thúc sớm",
};
export const statusName = (status: string) => names[status] ?? status;
export const dateTime = (date: string) =>
  new Date(date).toLocaleString("vi-VN");
export const money = (amount: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    amount,
  );
export function RideNav() {
  return (
    <nav className="social-tabs" aria-label="Di chuyển">
      <Link href="/feed">Bảng tin</Link>
      <Link href="/map">Tạo nhu cầu</Link>
      <Link href="/trips">Chuyến của tôi</Link>
      <Link href="/trips/new">Tạo chuyến</Link>
      <Link href="/proposals">Đề nghị</Link>
      <Link href="/bookings">Booking</Link>
    </nav>
  );
}

export function useRideCommand() {
  const client = useQueryClient();
  const keys = useRef(new Map<string, string>());
  return useMutation({
    mutationFn: async (input: {
      signature: string;
      run: (key: string) => Promise<unknown>;
    }) => {
      let key = keys.current.get(input.signature);
      if (!key) {
        key = crypto.randomUUID();
        keys.current.set(input.signature, key);
      }
      return input.run(key);
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["rides"] }),
        client.invalidateQueries({ queryKey: ["feed"] }),
      ]);
    },
    onError: async () => {
      await Promise.all([
        client.resetQueries({ queryKey: ["rides"] }),
        client.resetQueries({ queryKey: ["feed"] }),
      ]);
    },
  });
}

export function Feed() {
  const [tab, setTab] = useState("latest");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const list = useInfiniteQuery({
    queryKey: ["feed", tab],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => rideApi.feed(tab, pageParam),
    getNextPageParam: (last) => last.nextCursor || undefined,
    refetchInterval: 15000,
  });
  const caps = useQuery({
    queryKey: ["rides", "capabilities"],
    queryFn: rideApi.capabilities,
  });
  const session = useQuery({
    queryKey: ["auth", "session"],
    queryFn: authApi.session,
    retry: false,
  });
  useAuthFailure(list.error);
  const posts = list.data?.pages.flatMap((page) => page.items) ?? [];
  const visiblePosts = posts.filter((post) => {
    const matchesRole =
      roleFilter === "ALL" ||
      (roleFilter === "PASSENGER"
        ? post.type === "NEED_RIDE"
        : post.type !== "NEED_RIDE");
    const needle = search.trim().toLocaleLowerCase("vi");
    return (
      matchesRole &&
      (!needle ||
        `${post.originLabel} ${post.destinationLabel} ${post.note}`
          .toLocaleLowerCase("vi")
          .includes(needle))
    );
  });
  return (
    <main className="settings-page ride-feed-page">
      <PageHeader
        eyebrow="Cộng đồng Diké"
        title="Bảng tin di chuyển"
        description="Tìm người đồng hành có lịch trình phù hợp, lưu chuyến bạn quan tâm và cùng nhau đi xanh hơn mỗi ngày."
        actions={
          <Link className="app-button app-button--primary" href="/map">
            <Plus aria-hidden="true" size={18} />
            Đăng nhu cầu
          </Link>
        }
      />
      <RideNav />
      {caps.data && !caps.data.posting ? (
        <p role="status">{caps.data.message}</p>
      ) : null}
      <nav className="social-tabs" aria-label="Bảng tin">
        {Object.entries({
          latest: "Mới nhất",
          friends: "Bạn bè",
          community: "Cộng đồng",
          mine: "Bài của tôi",
          saved: "Đã lưu",
        }).map(([id, label]) => (
          <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
      <section className="feed-filter-bar" aria-label="Bộ lọc bài đăng">
        <label>
          <Search aria-hidden="true" size={17} />
          <span className="sr-only">Tìm theo địa điểm</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm điểm đi hoặc điểm đến"
          />
        </label>
        <div className="app-filter-tabs" role="group" aria-label="Vai trò">
          {[
            ["ALL", "Tất cả"],
            ["PASSENGER", "Cần đi nhờ"],
            ["DRIVER", "Có chỗ trống"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={roleFilter === value}
              onClick={() => setRoleFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
      {list.isPending ? (
        <LoadingState label="Đang tải bài đăng" />
      ) : list.isError ? (
        <ErrorState
          message={list.error.message}
          onRetry={() => void list.refetch()}
        />
      ) : (
        <>
          {visiblePosts.length === 0 ? (
            <EmptyState
              icon={Route}
              title={
                posts.length > 0
                  ? "Không có bài đăng phù hợp"
                  : tab === "latest"
                    ? "Chưa có bài đăng để hiển thị."
                    : "Chưa có nội dung trong mục này"
              }
              description={
                posts.length > 0
                  ? "Thử đổi vai trò hoặc từ khóa địa điểm."
                  : tab === "latest"
                    ? "Hãy đăng nhu cầu đầu tiên hoặc tạo một chuyến để cộng đồng có thể tìm thấy bạn."
                    : "Thử chuyển sang Bảng tin mới nhất hoặc điều chỉnh kết nối của bạn."
              }
              action={
                <Link className="app-button app-button--primary" href="/map">
                  <Plus aria-hidden="true" size={18} />
                  Tạo nhu cầu đi lại
                </Link>
              }
            />
          ) : null}
          <div className="feed-layout">
            <section className="feed-stream" aria-label="Danh sách bài đăng">
              {visiblePosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  owner={session.data?.user.id === post.ownerId}
                  saved={tab === "saved"}
                />
              ))}
            </section>
            {posts.length > 0 ? (
              <aside className="feed-aside" aria-label="Gợi ý di chuyển">
                <div className="app-panel feed-tip-card">
                  <span className="feed-tip-icon">
                    <Sparkles aria-hidden="true" size={20} />
                  </span>
                  <h2>Đi cùng an tâm hơn</h2>
                  <p>
                    Ưu tiên thành viên đã xác minh và luôn kiểm tra điểm đón
                    trước khi xác nhận.
                  </p>
                  <Link href="/verification">
                    Xem cấp độ xác minh{" "}
                    <ArrowRight aria-hidden="true" size={15} />
                  </Link>
                </div>
              </aside>
            ) : null}
          </div>
          {list.hasNextPage ? (
            <button
              className="app-button app-button--secondary feed-more"
              disabled={list.isFetchingNextPage}
              onClick={() => void list.fetchNextPage()}
            >
              Xem thêm
            </button>
          ) : null}
        </>
      )}
    </main>
  );
}
export function PostCard({
  post,
  owner,
  saved = false,
}: {
  post: RidePostView;
  owner: boolean;
  saved?: boolean;
}) {
  const command = useRideCommand();
  const act = (action: "publish" | "close") =>
    command.mutate({
      signature: `post:${post.id}:${post.version}:${action}`,
      run: (key) => rideApi.postAction(post.id, action, post.version, key),
    });
  return (
    <article className="settings-card ride-post-card">
      <header className="ride-post-author">
        <MemberAvatar
          name={post.ownerDisplayName || "Thành viên Diké"}
          avatarUrl={post.ownerAvatarUrl}
          className="app-avatar"
        />
        <div>
          <strong>{post.ownerDisplayName || "Thành viên Diké"}</strong>
          <span>
            <Clock3 aria-hidden="true" size={13} /> {dateTime(post.departureAt)}
          </span>
        </div>
        <span
          className={`ride-status ride-status--${post.status.toLowerCase()}`}
        >
          {statusName(post.status)}
        </span>
      </header>

      <Link
        className="ride-route-link"
        href={`/feed/${encodeURIComponent(post.id)}`}
        aria-label={`${post.originLabel} → ${post.destinationLabel}`}
      >
        <span className="ride-route-visual" aria-hidden="true">
          <i />
          <b />
          <i />
        </span>
        <span className="ride-route-copy">
          <small>Điểm đón</small>
          <strong>{post.originLabel}</strong>
          <small>Điểm đến</small>
          <strong>{post.destinationLabel}</strong>
        </span>
      </Link>

      <div className="ride-meta-grid">
        <span>
          <CarFront aria-hidden="true" size={17} />{" "}
          {post.vehicleType === "MOTORCYCLE" ? "Xe máy" : "Ô tô"}
        </span>
        <span>
          <Users aria-hidden="true" size={17} />{" "}
          {typeof post.remainingSeats === "number"
            ? `Còn ${post.remainingSeats} chỗ`
            : "Cần người đồng hành"}
        </span>
        <span>
          <CalendarClock aria-hidden="true" size={17} />{" "}
          {post.type === "NEED_RIDE" ? "Cần đi nhờ" : "Có chỗ đi cùng"}
        </span>
      </div>
      {post.note ? <p className="ride-note">“{post.note}”</p> : null}
      {typeof post.remainingSeats === "number" ? (
        <p className="ride-price">
          <strong>{money(post.contributionPerKm ?? 0)}</strong>
          <span>/ km</span>
        </p>
      ) : null}
      <footer className="ride-card-actions">
        <button
          className="ride-action-button"
          disabled={command.isPending}
          onClick={() =>
            command.mutate({
              signature: `save:${post.id}:${saved}`,
              run: () => rideApi.save(post.id, !saved),
            })
          }
        >
          <Bookmark
            aria-hidden="true"
            size={17}
            fill={saved ? "currentColor" : "none"}
          />
          {saved ? "Đã lưu" : "Lưu bài"}
        </button>
        <Link
          className="ride-action-button"
          href={`/feed/${encodeURIComponent(post.id)}`}
        >
          <MessageCircle aria-hidden="true" size={17} /> Trao đổi
        </Link>
        {owner && post.status === "DRAFT" ? (
          <button
            className="ride-action-button ride-action-button--primary"
            disabled={command.isPending}
            onClick={() => act("publish")}
          >
            <Send aria-hidden="true" size={16} />
            Đăng bài
          </button>
        ) : null}
        {owner && ["DRAFT", "OPEN", "MATCHED"].includes(post.status) ? (
          <button
            className="ride-action-button"
            disabled={command.isPending}
            onClick={() => act("close")}
          >
            <Check aria-hidden="true" size={16} />
            Đóng bài
          </button>
        ) : null}
      </footer>
      {command.isError ? <p role="alert">{command.error.message}</p> : null}
      {command.isSuccess ? <p role="status">Đã cập nhật.</p> : null}
    </article>
  );
}

export function RideDashboard({
  kind,
}: {
  kind: "trips" | "proposals" | "bookings";
}) {
  const list = useInfiniteQuery({
    queryKey: ["rides", kind],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({
      pageParam,
    }): Promise<{
      items: (TripView | ProposalView | BookingView)[];
      nextCursor?: string;
    }> => rideApi[kind](pageParam),
    getNextPageParam: (last) => last.nextCursor || undefined,
    refetchInterval: 15000,
  });
  const session = useQuery({
    queryKey: ["auth", "session"],
    queryFn: authApi.session,
    retry: false,
  });
  useAuthFailure(list.error);
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [bookingRole, setBookingRole] = useState("ALL");
  const bookingGroups: Record<string, string[]> = {
    UPCOMING: ["CONFIRMED", "DRIVER_ARRIVED"],
    ACTIVE: ["BOARDED", "IN_PROGRESS"],
    COMPLETED: ["COMPLETED"],
    CANCELLED: ["CANCELLED", "NO_SHOW", "ENDED_EARLY"],
  };
  const filteredItems = items.filter((item) => {
    const matchesStatus =
      statusFilter === "ALL" ||
      (kind === "bookings"
        ? bookingGroups[statusFilter]?.includes(item.status)
        : item.status === statusFilter);
    const matchesRole =
      kind !== "bookings" ||
      bookingRole === "ALL" ||
      !("passengerId" in item) ||
      (bookingRole === "DRIVER"
        ? item.driverId === session.data?.user.id
        : item.passengerId === session.data?.user.id);
    return matchesStatus && matchesRole;
  });
  const title = {
    trips: "Chuyến của tôi",
    proposals: "Đề nghị đi cùng",
    bookings: "Booking của tôi",
  }[kind];
  return (
    <main
      className={
        kind === "trips"
          ? "trip-gallery-page"
          : kind === "proposals"
            ? "proposal-board-page"
            : "settings-page ride-dashboard-page"
      }
    >
      {kind === "trips" ? (
        <header className="trip-gallery-hero">
          <div className="trip-gallery-hero-copy">
            <p>Quản lý hành trình</p>
            <h1>Chuyến của tôi</h1>
            <span>Theo dõi các chuyến bạn tạo và tình trạng ghép chỗ.</span>
            <Link href="/trips/new">
              <Plus aria-hidden="true" size={23} /> Tạo chuyến
            </Link>
          </div>
          <div className="trip-gallery-hero-art" aria-hidden="true">
            <i className="trip-gallery-pin" />
            <b />
            <span />
          </div>
        </header>
      ) : kind === "proposals" ? (
        <header className="proposal-board-hero">
          <div className="proposal-board-hero-copy">
            <p>Quản lý hành trình</p>
            <h1>Đề nghị đi cùng</h1>
            <span>Xem và phản hồi các lời mời đi cùng đang chờ bạn.</span>
          </div>
          <div className="proposal-board-hero-art" aria-hidden="true">
            <i className="proposal-art-pin is-first" />
            <i className="proposal-art-pin is-second" />
            <i className="proposal-art-pin is-third" />
            <b />
            <span>
              <CarFront size={32} />
            </span>
          </div>
        </header>
      ) : (
        <>
          <PageHeader
            eyebrow="Quản lý hành trình"
            title={title}
            description="Tất cả chuyến đã xác nhận, sẵn sàng cho ngày khởi hành."
          />
          <RideNav />
        </>
      )}
      {kind !== "trips" && items.length > 0 ? (
        <div
          className="journey-filter-bar"
          role="group"
          aria-label="Lọc theo trạng thái"
        >
          {(kind === "bookings"
            ? ["ALL", "UPCOMING", "ACTIVE", "COMPLETED", "CANCELLED"]
            : kind === "proposals"
              ? ["ALL", "PENDING"]
              : [
                  "ALL",
                  ...Array.from(new Set(items.map((item) => item.status))),
                ]
          ).map((status) => (
            <button
              aria-pressed={statusFilter === status}
              className={statusFilter === status ? "is-active" : ""}
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
            >
              {kind === "proposals" ? (
                status === "ALL" ? (
                  <Grid2X2 aria-hidden="true" size={16} />
                ) : (
                  <Clock3 aria-hidden="true" size={16} />
                )
              ) : null}
              {status === "ALL"
                ? "Tất cả"
                : kind === "proposals" && status === "PENDING"
                  ? "Chờ phản hồi"
                  : kind === "bookings"
                    ? {
                        UPCOMING: "Sắp tới",
                        ACTIVE: "Đang diễn ra",
                        COMPLETED: "Hoàn thành",
                        CANCELLED: "Đã hủy",
                      }[status]
                    : statusName(status)}
            </button>
          ))}
        </div>
      ) : null}
      {kind === "bookings" && items.length > 0 ? (
        <div
          className="journey-filter-bar"
          role="group"
          aria-label="Lọc theo vai trò"
        >
          {[
            ["ALL", "Mọi vai trò"],
            ["DRIVER", "Tài xế"],
            ["PASSENGER", "Hành khách"],
          ].map(([value, label]) => (
            <button
              aria-pressed={bookingRole === value}
              className={bookingRole === value ? "is-active" : ""}
              key={value}
              type="button"
              onClick={() => setBookingRole(value)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {list.isPending ? (
        <LoadingState />
      ) : list.isError ? (
        <ErrorState
          message={list.error.message}
          onRetry={() => void list.refetch()}
        />
      ) : (
        <>
          {items.length === 0 && kind !== "proposals" ? (
            <EmptyState
              icon={kind === "trips" ? CarFront : TicketCheck}
              title={
                kind === "trips"
                  ? "Bạn chưa có chuyến nào"
                  : "Chưa có booking nào"
              }
              description={
                kind === "trips"
                  ? "Tạo chuyến đầu tiên, chọn lộ trình và số chỗ trống để bắt đầu ghép bạn đồng hành."
                  : "Khi có hoạt động mới, thông tin sẽ xuất hiện tại đây để bạn xử lý."
              }
              action={
                kind === "trips" ? (
                  <Link
                    className="app-button app-button--primary"
                    href="/trips/new"
                  >
                    <Plus aria-hidden="true" size={18} /> Tạo chuyến đầu tiên
                  </Link>
                ) : (
                  <Link
                    className="app-button app-button--secondary"
                    href="/feed"
                  >
                    Khám phá bảng tin
                  </Link>
                )
              }
            />
          ) : null}
          {kind === "bookings" &&
          items.length > 0 &&
          filteredItems.length === 0 ? (
            <EmptyState
              icon={TicketCheck}
              title="Không có booking phù hợp"
              description="Hãy thử đổi trạng thái hoặc vai trò để xem các hành trình khác."
            />
          ) : null}
          {kind === "proposals" ? (
            <ProposalBoard
              proposals={filteredItems as ProposalView[]}
              userId={session.data?.user.id}
            />
          ) : (
            <div
              className={
                kind === "trips" ? "trip-gallery-grid" : "ride-dashboard-grid"
              }
            >
              {filteredItems.map((item, index) =>
                "senderId" in item ? (
                  <ProposalCard
                    key={item.id}
                    proposal={item}
                    userId={session.data?.user.id}
                  />
                ) : "passengerId" in item ? (
                  <article
                    className="settings-card ride-summary-card"
                    key={item.id}
                  >
                    <span className="ride-summary-icon">
                      <TicketCheck aria-hidden="true" size={20} />
                    </span>
                    <h2>
                      <Link href={`/bookings/${encodeURIComponent(item.id)}`}>
                        Booking lúc {dateTime(item.pickupAt)}
                      </Link>
                    </h2>
                    <span
                      className={`ride-status ride-status--${item.status.toLowerCase()}`}
                    >
                      {statusName(item.status)}
                    </span>
                    <p>Đón {dateTime(item.pickupAt)}</p>
                    <p>
                      Trả {dateTime(item.dropoffAt)} · {money(item.priceVnd)}
                    </p>
                    <p className="journey-next-action">
                      {bookingNextAction(
                        item.status,
                        item.driverId === session.data?.user.id,
                      )}
                    </p>
                  </article>
                ) : (
                  <TripGalleryCard
                    key={item.id}
                    trip={item}
                    variant={index % 3}
                  />
                ),
              )}
            </div>
          )}
          {list.hasNextPage ? (
            <button
              disabled={list.isFetchingNextPage}
              onClick={() => void list.fetchNextPage()}
            >
              Xem thêm
            </button>
          ) : null}
        </>
      )}
    </main>
  );
}

function ProposalBoard({
  proposals,
  userId,
}: {
  proposals: ProposalView[];
  userId?: string;
}) {
  const incoming = proposals.filter((item) => item.recipientId === userId);
  const outgoing = proposals.filter((item) => item.recipientId !== userId);
  return (
    <div className="proposal-board-grid">
      <ProposalColumn
        icon={<Handshake aria-hidden="true" size={25} />}
        title="Đề nghị đến"
        description="Các lời mời đi cùng từ người khác đang chờ bạn phản hồi."
        empty="Chưa có đề nghị gửi đến."
        items={incoming}
        userId={userId}
      />
      <ProposalColumn
        icon={<Send aria-hidden="true" size={25} />}
        title="Đề nghị đã gửi"
        description="Các đề nghị đi cùng bạn đã gửi cho người khác."
        empty="Bạn chưa gửi đề nghị nào."
        items={outgoing}
        userId={userId}
      />
    </div>
  );
}

function ProposalColumn({
  icon,
  title,
  description,
  empty,
  items,
  userId,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  empty: string;
  items: ProposalView[];
  userId?: string;
}) {
  return (
    <section className="proposal-board-column">
      <header>
        <span>{icon}</span>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </header>
      <div className="proposal-board-list">
        {items.length ? (
          items.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              userId={userId}
            />
          ))
        ) : (
          <p className="proposal-board-empty">{empty}</p>
        )}
      </div>
    </section>
  );
}

function TripGalleryCard({
  trip,
  variant,
}: {
  trip: TripView;
  variant: number;
}) {
  const departure = new Date(trip.departureAt);
  return (
    <article className="trip-gallery-card">
      <Link
        className="trip-gallery-card-link"
        href={`/trips/${encodeURIComponent(trip.id)}`}
        aria-label={`${trip.originLabel} đến ${trip.destinationLabel}`}
      >
        <div className={`trip-gallery-art is-variant-${variant}`}>
          <span className="trip-gallery-route-icon">
            <Route aria-hidden="true" size={20} />
          </span>
          <span className="trip-gallery-more" aria-hidden="true">
            <MoreHorizontal size={22} />
          </span>
          <i className="trip-gallery-landmark" />
          <b className="trip-gallery-road" />
          <span className="trip-gallery-art-pin" />
        </div>
        <div className="trip-gallery-card-body">
          <h2>
            {trip.originLabel} → {trip.destinationLabel}
          </h2>
          <div className="trip-gallery-meta">
            <span
              className={`trip-gallery-status is-${trip.status.toLowerCase()}`}
            >
              <i /> {statusName(trip.status)}
            </span>
            <span>
              <Users aria-hidden="true" size={17} /> Còn {trip.remainingSeats}/
              {trip.offeredSeats} chỗ
            </span>
          </div>
          <time dateTime={trip.departureAt}>
            <CalendarClock aria-hidden="true" size={19} />
            <span>
              <strong>
                {departure.toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Asia/Ho_Chi_Minh",
                })}
              </strong>
              <small>
                {departure.toLocaleDateString("vi-VN", {
                  timeZone: "Asia/Ho_Chi_Minh",
                })}
              </small>
            </span>
          </time>
        </div>
      </Link>
    </article>
  );
}

function bookingNextAction(status: string, driver: boolean) {
  if (status === "CONFIRMED")
    return driver
      ? "Tiếp theo: xác nhận đã đến điểm đón"
      : "Tiếp theo: chuẩn bị mã lên xe";
  if (status === "DRIVER_ARRIVED")
    return driver
      ? "Tiếp theo: nhập mã lên xe"
      : "Tài xế đang chờ tại điểm đón";
  if (status === "BOARDED") return "Hành khách đã lên xe";
  if (status === "IN_PROGRESS")
    return driver
      ? "Tiếp theo: xác nhận đã trả khách"
      : "Chuyến đi đang diễn ra";
  if (status === "COMPLETED") return "Hoàn tất thanh toán và đánh giá";
  return "Xem chi tiết hành trình";
}
function ProposalCard({
  proposal: p,
  userId,
}: {
  proposal: ProposalView;
  userId?: string;
}) {
  const command = useRideCommand();
  const recipient = p.recipientId === userId;
  const act = (action: "accept" | "reject" | "withdraw") =>
    command.mutate({
      signature: `proposal:${p.id}:${p.version}:${action}`,
      run: (key) =>
        action === "accept"
          ? rideApi.accept(p.id, p.version, key)
          : rideApi.decide(p.id, action, p.version, key),
    });
  return (
    <article className="proposal-board-card">
      <header>
        <span className={`proposal-board-status is-${p.status.toLowerCase()}`}>
          <Clock3 aria-hidden="true" size={16} /> {statusName(p.status)}
        </span>
        <Link
          href={`/proposals/${encodeURIComponent(p.id)}`}
          aria-label="Xem chi tiết đề nghị"
        >
          <MoreHorizontal aria-hidden="true" size={21} />
        </Link>
      </header>
      <div className="proposal-board-route">
        <span aria-hidden="true">
          <i />
          <b />
          <i />
        </span>
        <div>
          <section>
            <small>Đón</small>
            <strong>{dateTime(p.pickupAt)}</strong>
            <p>Điểm đón sẽ hiển thị trong chi tiết đề nghị.</p>
          </section>
          <MapPin aria-hidden="true" size={18} />
          <section>
            <small>Đến</small>
            <strong>{dateTime(p.dropoffAt)}</strong>
            <p>Điểm đến sẽ hiển thị trong chi tiết đề nghị.</p>
          </section>
          <MapPin aria-hidden="true" size={18} />
        </div>
      </div>
      <dl className="proposal-board-facts">
        <div>
          <dt>
            <Coins aria-hidden="true" size={18} /> Mức đóng góp
          </dt>
          <dd>{money(p.priceVnd)}</dd>
        </div>
        <div>
          <dt>
            <Clock3 aria-hidden="true" size={18} /> Hiệu lực đến
          </dt>
          <dd>{dateTime(p.expiresAt)}</dd>
        </div>
      </dl>
      {p.status === "PENDING" ? (
        <footer>
          {recipient ? (
            <>
              <button
                className="is-primary"
                disabled={command.isPending}
                onClick={() => act("accept")}
              >
                <Check aria-hidden="true" size={18} /> Đồng ý đi cùng
              </button>
              <button
                disabled={command.isPending}
                onClick={() => act("reject")}
              >
                <X aria-hidden="true" size={18} /> Từ chối
              </button>
            </>
          ) : (
            <button
              disabled={command.isPending}
              onClick={() => act("withdraw")}
            >
              <Trash2 aria-hidden="true" size={18} /> Rút đề nghị
            </button>
          )}
        </footer>
      ) : null}
      {command.isError ? (
        <p className="proposal-board-feedback" role="alert">
          {command.error.message}
        </p>
      ) : null}
      {command.isSuccess ? (
        <p className="proposal-board-feedback is-success" role="status">
          Đã xử lý đề nghị. <Link href="/bookings">Xem booking</Link>
        </p>
      ) : null}
    </article>
  );
}
