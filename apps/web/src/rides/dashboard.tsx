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
  return (
    <main className="settings-page">
      <h1>Bảng tin di chuyển</h1>
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
        <p>Đang tải bài đăng…</p>
      ) : list.isError ? (
        <p role="alert">{list.error.message}</p>
      ) : (
        <>
          {list.data.pages.flatMap((page) => page.items).length === 0 ? (
            <p>Chưa có bài đăng để hiển thị.</p>
          ) : null}
          {list.data.pages
            .flatMap((page) => page.items)
            .map((post) => (
              <PostCard
                key={post.id}
                post={post}
                owner={session.data?.user.id === post.ownerId}
                saved={tab === "saved"}
              />
            ))}
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
    <article className="settings-card">
      <h2>
        <Link href={`/feed/${encodeURIComponent(post.id)}`}>
          {post.originLabel} → {post.destinationLabel}
        </Link>
      </h2>
      <p>
        {post.type === "NEED_RIDE" ? "Cần đi nhờ" : "Có chỗ đi cùng"} ·{" "}
        {statusName(post.status)}
      </p>
      <p>
        {dateTime(post.departureAt)} ·{" "}
        {post.vehicleType === "MOTORCYCLE" ? "Xe máy" : "Ô tô"}
      </p>
      {typeof post.remainingSeats === "number" ? (
        <p>
          Còn {post.remainingSeats} chỗ · {money(post.contributionPerKm ?? 0)}
          /km
        </p>
      ) : null}
      <p>{post.note}</p>
      <div className="social-tabs">
        <button
          disabled={command.isPending}
          onClick={() =>
            command.mutate({
              signature: `save:${post.id}:${saved}`,
              run: () => rideApi.save(post.id, !saved),
            })
          }
        >
          {saved ? "Bỏ lưu" : "Lưu bài"}
        </button>
        {owner && post.status === "DRAFT" ? (
          <button disabled={command.isPending} onClick={() => act("publish")}>
            Đăng bài
          </button>
        ) : null}
        {owner && ["DRAFT", "OPEN", "MATCHED"].includes(post.status) ? (
          <button disabled={command.isPending} onClick={() => act("close")}>
            Đóng bài
          </button>
        ) : null}
      </div>
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
  return (
    <main className="settings-page">
      <h1>
        {
          {
            trips: "Chuyến của tôi",
            proposals: "Đề nghị đi cùng",
            bookings: "Booking của tôi",
          }[kind]
        }
      </h1>
      <RideNav />
      {list.isPending ? (
        <p>Đang tải…</p>
      ) : list.isError ? (
        <p role="alert">{list.error.message}</p>
      ) : (
        <>
          {list.data.pages.flatMap((p) => p.items).length === 0 ? (
            <p>Chưa có dữ liệu.</p>
          ) : null}
          {list.data.pages
            .flatMap((p) => p.items)
            .map((item) =>
              "senderId" in item ? (
                <ProposalCard
                  key={item.id}
                  proposal={item}
                  userId={session.data?.user.id}
                />
              ) : "passengerId" in item ? (
                <article className="settings-card" key={item.id}>
                  <h2>
                    <Link href={`/bookings/${encodeURIComponent(item.id)}`}>
                      Chuyến lúc {dateTime(item.pickupAt)}
                    </Link>
                  </h2>
                  <p>
                    {statusName(item.status)} · {money(item.priceVnd)}
                  </p>
                </article>
              ) : (
                <article className="settings-card" key={item.id}>
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
    <article className="settings-card">
      <h2>{recipient ? "Đề nghị đến" : "Đề nghị đã gửi"}</h2>
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
