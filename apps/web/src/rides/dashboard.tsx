"use client";

import Link from "next/link";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRef, useState } from "react";
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
  Handshake,
  MessageCircle,
  Plus,
  Route,
  Send,
  Sparkles,
  TicketCheck,
  Users,
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
      {list.isPending ? (
        <LoadingState label="Đang tải bài đăng" />
      ) : list.isError ? (
        <ErrorState
          message={list.error.message}
          onRetry={() => void list.refetch()}
        />
      ) : (
        <>
          {posts.length === 0 ? (
            <EmptyState
              icon={Route}
              title={
                tab === "latest"
                  ? "Chưa có bài đăng để hiển thị."
                  : "Chưa có nội dung trong mục này"
              }
              description={
                tab === "latest"
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
              {posts.map((post) => (
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
        <span className="app-avatar" aria-hidden="true">
          DK
        </span>
        <div>
          <strong>Thành viên Diké</strong>
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
  const filteredItems =
    statusFilter === "ALL"
      ? items
      : items.filter((item) => item.status === statusFilter);
  const title = {
    trips: "Chuyến của tôi",
    proposals: "Đề nghị đi cùng",
    bookings: "Booking của tôi",
  }[kind];
  return (
    <main className="settings-page ride-dashboard-page">
      <PageHeader
        eyebrow="Quản lý hành trình"
        title={title}
        description={
          kind === "trips"
            ? "Theo dõi các chuyến bạn tạo và tình trạng ghép chỗ."
            : kind === "proposals"
              ? "Xem và phản hồi các lời mời đi cùng đang chờ bạn."
              : "Tất cả chuyến đã xác nhận, sẵn sàng cho ngày khởi hành."
        }
        actions={
          kind === "trips" ? (
            <Link className="app-button app-button--primary" href="/trips/new">
              <Plus aria-hidden="true" size={18} /> Tạo chuyến
            </Link>
          ) : undefined
        }
      />
      <RideNav />
      {kind !== "trips" && items.length > 0 ? (
        <div
          className="journey-filter-bar"
          role="group"
          aria-label="Lọc theo trạng thái"
        >
          {[
            "ALL",
            ...Array.from(new Set(items.map((item) => item.status))),
          ].map((status) => (
            <button
              aria-pressed={statusFilter === status}
              className={statusFilter === status ? "is-active" : ""}
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
            >
              {status === "ALL" ? "Tất cả" : statusName(status)}
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
          {items.length === 0 ? (
            <EmptyState
              icon={
                kind === "trips"
                  ? CarFront
                  : kind === "proposals"
                    ? Handshake
                    : TicketCheck
              }
              title={
                kind === "trips"
                  ? "Bạn chưa có chuyến nào"
                  : kind === "proposals"
                    ? "Chưa có đề nghị mới"
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
          <div className="ride-dashboard-grid">
            {filteredItems.map((item) =>
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
                </article>
              ) : (
                <article
                  className="settings-card ride-summary-card"
                  key={item.id}
                >
                  <span className="ride-summary-icon">
                    <Route aria-hidden="true" size={20} />
                  </span>
                  <h2>
                    <Link href={`/trips/${encodeURIComponent(item.id)}`}>
                      {item.originLabel} → {item.destinationLabel}
                    </Link>
                  </h2>
                  <p>
                    {statusName(item.status)} · Còn {item.remainingSeats}/
                    {item.offeredSeats} chỗ
                  </p>
                  <p>{dateTime(item.departureAt)}</p>
                </article>
              ),
            )}
          </div>
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
    <article className="settings-card ride-summary-card proposal-card">
      <span className="ride-summary-icon">
        <Handshake aria-hidden="true" size={20} />
      </span>
      <h2>
        <Link href={`/proposals/${encodeURIComponent(p.id)}`}>
          {recipient ? "Đề nghị đến" : "Đề nghị đã gửi"}
        </Link>
      </h2>
      <span className={`ride-status ride-status--${p.status.toLowerCase()}`}>
        {statusName(p.status)}
      </span>
      <p>
        {statusName(p.status)} · {money(p.priceVnd)}
      </p>
      <p>
        Đón {dateTime(p.pickupAt)} · Đến {dateTime(p.dropoffAt)}
      </p>
      <p>Hiệu lực đến {dateTime(p.expiresAt)}</p>
      {p.status === "PENDING" ? (
        <div className="social-tabs">
          {recipient ? (
            <>
              <button
                disabled={command.isPending}
                onClick={() => act("accept")}
              >
                Đồng ý đi cùng
              </button>
              <button
                disabled={command.isPending}
                onClick={() => act("reject")}
              >
                Từ chối
              </button>
            </>
          ) : (
            <button
              disabled={command.isPending}
              onClick={() => act("withdraw")}
            >
              Rút đề nghị
            </button>
          )}
        </div>
      ) : null}
      {command.isError ? <p role="alert">{command.error.message}</p> : null}
      {command.isSuccess ? (
        <p role="status">
          Đã xử lý đề nghị. <Link href="/bookings">Xem booking</Link>
        </p>
      ) : null}
    </article>
  );
}
