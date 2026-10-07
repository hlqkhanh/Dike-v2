"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { rideApi } from "./api";
import { authApi } from "../auth/api";
import { useAuthFailure } from "../auth/use-auth-failure";
import {
  RideNav,
  PostCard,
  dateTime,
  money,
  statusName,
  useRideCommand,
} from "./dashboard";

export function PostDetail({ id }: { id: string }) {
  const post = useQuery({
    queryKey: ["feed", "detail", id],
    queryFn: () => rideApi.post(id),
    refetchInterval: 15000,
    retry: false,
  });
  const session = useQuery({
    queryKey: ["auth", "session"],
    queryFn: authApi.session,
  });
  const [reason, setReason] = useState("UNSAFE");
  const [note, setNote] = useState("");
  const command = useRideCommand();
  useAuthFailure(post.error);
  return (
    <main className="settings-page">
      <h1>Chi tiết bài đăng</h1>
      <RideNav />
      {post.isPending ? (
        <p>Đang tải…</p>
      ) : post.isError ? (
        <p role="alert">{post.error.message}</p>
      ) : (
        <>
          <PostCard
            post={post.data}
            owner={post.data.ownerId === session.data?.user.id}
          />
          <details className="settings-card">
            <summary>Báo cáo bài đăng</summary>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                command.mutate({
                  signature: `report:${id}:${reason}:${note}`,
                  run: (key) =>
                    rideApi.report({ postId: id, reason, note }, key),
                });
              }}
            >
              <label>
                Lý do
                <select
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                >
                  <option value="UNSAFE">Không an toàn</option>
                  <option value="SPAM">Spam</option>
                  <option value="MISLEADING">Sai thông tin</option>
                  <option value="OTHER">Khác</option>
                </select>
              </label>
              <label>
                Thông tin bổ sung
                <textarea
                  maxLength={1000}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
              <button disabled={command.isPending || command.isSuccess}>
                Gửi báo cáo
              </button>
            </form>
            {command.isSuccess ? (
              <p role="status">Đã tiếp nhận báo cáo.</p>
            ) : null}
            {command.isError ? (
              <p role="alert">{command.error.message}</p>
            ) : null}
          </details>
        </>
      )}
    </main>
  );
}

export function TripDetail({ id }: { id: string }) {
  const trip = useQuery({
    queryKey: ["rides", "trip", id],
    queryFn: () => rideApi.trip(id),
    refetchInterval: 15000,
    retry: false,
  });
  const session = useQuery({
    queryKey: ["auth", "session"],
    queryFn: authApi.session,
  });
  const [reason, setReason] = useState("");
  const command = useRideCommand();
  useAuthFailure(trip.error);
  const act = (action: string) => {
    if (!trip.data) return;
    const version = trip.data.version;
    command.mutate({
      signature: `trip:${id}:${version}:${action}:${reason}`,
      run: (key) =>
        action === "open"
          ? rideApi.openTrip(id, version, key)
          : rideApi.tripAction(id, { version, action, reason }, key),
    });
  };
  return (
    <main className="settings-page">
      <h1>Chi tiết chuyến</h1>
      <RideNav />
      {trip.isPending ? (
        <p>Đang tải…</p>
      ) : trip.isError ? (
        <p role="alert">{trip.error.message}</p>
      ) : (
        <article className="settings-card">
          <h2>
            {trip.data.originLabel} → {trip.data.destinationLabel}
          </h2>
          <p>
            {statusName(trip.data.status)} · {dateTime(trip.data.departureAt)}
          </p>
          <p>
            Còn {trip.data.remainingSeats}/{trip.data.offeredSeats} chỗ ·{" "}
            {money(trip.data.contributionPerKm)}/km
          </p>
          {session.data?.user.id === trip.data.driverId ? (
            <>
              <label>
                Lý do hủy
                <input
                  value={reason}
                  maxLength={500}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <div className="social-tabs">
                {trip.data.status === "DRAFT" ? (
                  <button
                    disabled={command.isPending}
                    onClick={() => act("open")}
                  >
                    Mở chuyến
                  </button>
                ) : null}
                {["OPEN", "FULL"].includes(trip.data.status) ? (
                  <button
                    disabled={command.isPending}
                    onClick={() => act("start")}
                  >
                    Bắt đầu chuyến
                  </button>
                ) : null}
                {trip.data.status === "IN_PROGRESS" ? (
                  <button
                    disabled={command.isPending}
                    onClick={() => act("complete")}
                  >
                    Hoàn tất chuyến
                  </button>
                ) : null}
                {["DRAFT", "OPEN", "FULL"].includes(trip.data.status) ? (
                  <button
                    disabled={command.isPending || !reason.trim()}
                    onClick={() => act("cancel")}
                  >
                    Hủy chuyến
                  </button>
                ) : null}
              </div>
            </>
          ) : null}
        </article>
      )}
      {command.isError ? <p role="alert">{command.error.message}</p> : null}
    </main>
  );
}

export function BookingDetail({ id }: { id: string }) {
  const booking = useQuery({
    queryKey: ["rides", "booking", id],
    queryFn: () => rideApi.booking(id),
    refetchInterval: 15000,
    retry: false,
  });
  const session = useQuery({
    queryKey: ["auth", "session"],
    queryFn: authApi.session,
  });
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const [visibleCode, setVisibleCode] = useState<{
    code: string;
    version: number;
  } | null>(null);
  const [codeError, setCodeError] = useState("");
  const command = useRideCommand();
  useAuthFailure(booking.error);
  const act = (action: string) => {
    if (!booking.data) return;
    const version = booking.data.version;
    setVisibleCode(null);
    command.mutate({
      signature: `booking:${id}:${version}:${action}:${reason}`,
      run: (key) =>
        rideApi.bookingAction(id, { version, action, reason, code }, key),
    });
    setCode("");
  };
  const b = booking.data;
  const driver = b?.driverId === session.data?.user.id;
  const waiting = b && ["CONFIRMED", "DRIVER_ARRIVED"].includes(b.status);
  const aboard = b && ["BOARDED", "IN_PROGRESS"].includes(b.status);
  return (
    <main className="settings-page">
      <h1>Chi tiết booking</h1>
      <RideNav />
      {booking.isPending ? (
        <p>Đang tải…</p>
      ) : booking.isError ? (
        <p role="alert">{booking.error.message}</p>
      ) : b ? (
        <article className="settings-card">
          <h2>{statusName(b.status)}</h2>
          <p>
            Đón {dateTime(b.pickupAt)} · Đến {dateTime(b.dropoffAt)}
          </p>
          <p>Mức đóng góp đã chốt: {money(b.priceVnd)}</p>
          {b.reason ? <p>Lý do: {b.reason}</p> : null}
          {waiting && !driver ? (
            <div>
              <button
                onClick={() => {
                  if (visibleCode) {
                    setVisibleCode(null);
                    return;
                  }
                  void rideApi
                    .boardingCode(id)
                    .then((value) => {
                      setVisibleCode({ code: value.code, version: b.version });
                      setCodeError("");
                    })
                    .catch((error: Error) => setCodeError(error.message));
                }}
              >
                {visibleCode?.version === b.version
                  ? "Ẩn mã lên xe"
                  : "Xem mã lên xe"}
              </button>
              {visibleCode?.version === b.version ? (
                <p role="status">
                  Mã lên xe: <strong>{visibleCode.code}</strong>
                </p>
              ) : null}
              {codeError ? <p role="alert">{codeError}</p> : null}
            </div>
          ) : null}
          {waiting && driver ? (
            <label>
              Mã lên xe do hành khách cung cấp
              <input
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, ""))
                }
              />
            </label>
          ) : null}
          {waiting || aboard ? (
            <label>
              Lý do hủy, vắng mặt hoặc kết thúc sớm
              <textarea
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          ) : null}
          <div className="social-tabs">
            {driver && b.status === "CONFIRMED" ? (
              <button
                disabled={command.isPending}
                onClick={() => act("ARRIVE")}
              >
                Đã đến điểm đón
              </button>
            ) : null}
            {driver && waiting ? (
              <>
                <button
                  disabled={command.isPending || code.length !== 6}
                  onClick={() => act("BOARD")}
                >
                  Xác nhận lên xe
                </button>
                <button
                  disabled={
                    command.isPending ||
                    !reason.trim() ||
                    Date.now() < new Date(b.pickupAt).getTime() + 600000
                  }
                  onClick={() => act("NO_SHOW")}
                >
                  Khách không có mặt
                </button>
              </>
            ) : null}
            {waiting ? (
              <button
                disabled={command.isPending || !reason.trim()}
                onClick={() => act("CANCEL")}
              >
                Hủy booking
              </button>
            ) : null}
            {aboard ? (
              <button
                disabled={command.isPending || !reason.trim()}
                onClick={() => act("END_EARLY")}
              >
                Kết thúc sớm
              </button>
            ) : null}
            {driver && b.status === "IN_PROGRESS" ? (
              <button
                disabled={command.isPending}
                onClick={() => act("COMPLETE")}
              >
                Đã trả khách
              </button>
            ) : null}
          </div>
        </article>
      ) : null}
      {command.isError ? <p role="alert">{command.error.message}</p> : null}
    </main>
  );
}
