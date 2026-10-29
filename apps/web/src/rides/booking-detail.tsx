"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  CircleDollarSign,
  KeyRound,
  TicketCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  ErrorState,
  LoadingState,
  PageHeader,
} from "../../app/components/app-ui";
import { authApi } from "../auth/api";
import { useAuthFailure } from "../auth/use-auth-failure";
import { BookingTools } from "../journey/booking-tools";
import { journeyApi } from "../journey/api";
import { rideApi } from "./api";
import {
  dateTime,
  money,
  RideNav,
  statusName,
  useRideCommand,
} from "./dashboard";

const timeline = [
  { status: "CONFIRMED", label: "Đã xác nhận" },
  { status: "DRIVER_ARRIVED", label: "Đã đến điểm đón" },
  { status: "BOARDED", label: "Đã lên xe" },
  { status: "IN_PROGRESS", label: "Đang di chuyển" },
  { status: "COMPLETED", label: "Hoàn thành" },
  { status: "PAYMENT", label: "Thanh toán" },
] as const;

export function BookingDetail({ id }: { id: string }) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const [visibleCode, setVisibleCode] = useState<{
    code: string;
    version: number;
  } | null>(null);
  const [codeError, setCodeError] = useState("");
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
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
  const payment = useQuery({
    queryKey: ["payment", id],
    queryFn: () => journeyApi.payment(id),
    enabled: Boolean(booking.data),
    refetchInterval: 15000,
    retry: false,
  });
  const cashPayment = useQuery({
    queryKey: ["cash-payment", id],
    queryFn: () => journeyApi.cashPayment(id),
    enabled: Boolean(booking.data),
    refetchInterval: 15000,
    retry: false,
  });
  const command = useRideCommand();
  useAuthFailure(booking.error);
  const item = booking.data;
  const driver = item?.driverId === session.data?.user.id;
  const waiting = Boolean(
    item && ["CONFIRMED", "DRIVER_ARRIVED"].includes(item.status),
  );
  const aboard = Boolean(
    item && ["BOARDED", "IN_PROGRESS"].includes(item.status),
  );
  const terminal = Boolean(
    item &&
      ["COMPLETED", "CANCELLED", "NO_SHOW", "ENDED_EARLY"].includes(
        item.status,
      ),
  );
  const act = (action: string) => {
    if (!item) return;
    setVisibleCode(null);
    command.mutate({
      signature: `booking:${id}:${item.version}:${action}:${reason}`,
      run: (key) =>
        rideApi.bookingAction(
          id,
          { version: item.version, action, reason, code },
          key,
        ),
    });
    setCode("");
  };
  const showCode = async () => {
    if (!item) return;
    if (visibleCode) {
      setVisibleCode(null);
      return;
    }
    try {
      const value = await rideApi.boardingCode(id);
      setVisibleCode({ code: value.code, version: item.version });
      setCodeError("");
    } catch (error) {
      setCodeError(
        error instanceof Error ? error.message : "Không thể tải mã lên xe.",
      );
    }
  };

  return (
    <main className="settings-page journey-detail-page">
      <PageHeader
        eyebrow="Hành trình đã xác nhận"
        title="Chi tiết booking"
        description="Theo dõi tiến trình đón trả, xác nhận lên xe và hoàn tất chuyến."
        backHref="/bookings"
        backLabel="Quay lại danh sách booking"
      />
      <RideNav />
      {booking.isPending ? <LoadingState label="Đang tải booking" /> : null}
      {booking.isError ? (
        <ErrorState
          message={booking.error.message}
          onRetry={() => void booking.refetch()}
        />
      ) : null}
      {item && !booking.isError ? (
        <>
          <div className="journey-detail-layout">
            <section className="journey-detail-main">
              <article className="settings-card booking-progress-card">
                <div className="journey-card-heading">
                  <span className="journey-heading-icon">
                    <TicketCheck aria-hidden="true" size={22} />
                  </span>
                  <div>
                    <p className="app-eyebrow">Tiến trình chuyến</p>
                    <h2>{statusName(item.status)}</h2>
                  </div>
                  <span
                    className={`ride-status ride-status--${item.status.toLowerCase()}`}
                  >
                    {statusName(item.status)}
                  </span>
                </div>
                <ol
                  className="booking-timeline"
                  aria-label="Tiến trình booking"
                >
                  {timeline.map((step, index) => {
                    const activeIndex = timeline.findIndex(
                      (candidate) => candidate.status === item.status,
                    );
                    const done =
                      step.status === "PAYMENT"
                        ? item.status === "COMPLETED" &&
                          Boolean(
                            payment.data?.bankVerified ||
                              cashPayment.data?.locked,
                          )
                        : item.status === "COMPLETED" ||
                          (activeIndex >= 0 && index <= activeIndex);
                    return (
                      <li
                        className={done ? "is-complete" : ""}
                        key={step.status}
                      >
                        <span>{index + 1}</span>
                        <small>{step.label}</small>
                      </li>
                    );
                  })}
                </ol>
                {item.reason ? (
                  <div className="booking-reason">
                    <strong>Lý do cập nhật</strong>
                    <p>{item.reason}</p>
                  </div>
                ) : null}
              </article>

              {!terminal ? (
                <section className="settings-card journey-actions-card">
                  <div className="section-heading">
                    <div>
                      <p className="app-eyebrow">
                        {driver ? "Dành cho tài xế" : "Dành cho hành khách"}
                      </p>
                      <h2>Thao tác booking</h2>
                    </div>
                  </div>
                  {waiting && !driver ? (
                    <div className="boarding-code-panel">
                      <KeyRound aria-hidden="true" size={22} />
                      <div>
                        <strong>Mã lên xe</strong>
                        <p>Chỉ cung cấp mã này cho tài xế khi bạn đã có mặt.</p>
                        {visibleCode?.version === item.version ? (
                          <output aria-live="polite">{visibleCode.code}</output>
                        ) : null}
                      </div>
                      <button
                        className="app-button app-button--secondary"
                        type="button"
                        onClick={() => void showCode()}
                      >
                        {visibleCode ? "Ẩn mã lên xe" : "Xem mã lên xe"}
                      </button>
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
                        placeholder="Bắt buộc với thao tác hủy hoặc kết thúc sớm"
                        onChange={(event) => setReason(event.target.value)}
                      />
                    </label>
                  ) : null}
                  <div className="journey-action-row">
                    {driver && item.status === "CONFIRMED" ? (
                      <button
                        className="app-button app-button--primary"
                        disabled={command.isPending}
                        onClick={() => act("ARRIVE")}
                      >
                        Đã đến điểm đón
                      </button>
                    ) : null}
                    {driver && waiting ? (
                      <>
                        <button
                          className="app-button app-button--primary"
                          disabled={command.isPending || code.length !== 6}
                          onClick={() => act("BOARD")}
                        >
                          Xác nhận lên xe
                        </button>
                        <button
                          className="app-button app-button--danger"
                          disabled={
                            command.isPending ||
                            !reason.trim() ||
                            now < new Date(item.pickupAt).getTime() + 600000
                          }
                          onClick={() => act("NO_SHOW")}
                        >
                          Khách không có mặt
                        </button>
                      </>
                    ) : null}
                    {waiting ? (
                      <button
                        className="app-button app-button--danger"
                        disabled={command.isPending || !reason.trim()}
                        onClick={() => act("CANCEL")}
                      >
                        Hủy booking
                      </button>
                    ) : null}
                    {aboard ? (
                      <button
                        className="app-button app-button--danger"
                        disabled={command.isPending || !reason.trim()}
                        onClick={() => act("END_EARLY")}
                      >
                        Kết thúc sớm
                      </button>
                    ) : null}
                    {driver && item.status === "IN_PROGRESS" ? (
                      <button
                        className="app-button app-button--primary"
                        disabled={command.isPending}
                        onClick={() => act("COMPLETE")}
                      >
                        Đã trả khách
                      </button>
                    ) : null}
                  </div>
                  {codeError ? <p role="alert">{codeError}</p> : null}
                  {command.isPending ? (
                    <p className="form-hint" role="status">
                      Đang cập nhật booking…
                    </p>
                  ) : null}
                  {command.isSuccess ? (
                    <p className="success-notice" role="status">
                      Booking đã được cập nhật.
                    </p>
                  ) : null}
                  {command.isError ? (
                    <p role="alert">{command.error.message}</p>
                  ) : null}
                </section>
              ) : null}
              {!driver &&
              ["CANCELLED", "NO_SHOW", "ENDED_EARLY"].includes(item.status) ? (
                <button
                  className="app-button app-button--secondary"
                  disabled={command.isPending}
                  onClick={() =>
                    command.mutate({
                      signature: `again:${id}:${item.version}`,
                      run: async (key) => {
                        const result = await rideApi.findAgain(
                          id,
                          item.version,
                          key,
                        );
                        router.push(
                          `/feed/${encodeURIComponent(result.postId)}`,
                        );
                        return result;
                      },
                    })
                  }
                >
                  Tìm lại chuyến
                </button>
              ) : null}
            </section>
            <aside
              className="settings-card journey-facts-card"
              aria-label="Thông tin booking"
            >
              <h2>Thông tin booking</h2>
              <dl className="journey-fact-list">
                <div>
                  <dt>
                    <CalendarClock aria-hidden="true" size={18} /> Thời gian đón
                  </dt>
                  <dd>{dateTime(item.pickupAt)}</dd>
                </div>
                <div>
                  <dt>
                    <CalendarClock aria-hidden="true" size={18} /> Thời gian trả
                  </dt>
                  <dd>{dateTime(item.dropoffAt)}</dd>
                </div>
                <div>
                  <dt>
                    <CircleDollarSign aria-hidden="true" size={18} /> Mức đóng
                    góp
                  </dt>
                  <dd>{money(item.priceVnd)}</dd>
                </div>
                <div>
                  <dt>
                    <UserRound aria-hidden="true" size={18} /> Vai trò của bạn
                  </dt>
                  <dd>{driver ? "Tài xế" : "Hành khách"}</dd>
                </div>
              </dl>
              <Link
                className="app-inline-link"
                href={`/trips/${encodeURIComponent(item.tripId)}`}
              >
                Xem chuyến liên quan
              </Link>
            </aside>
          </div>
          <BookingTools
            bookingId={id}
            driver={Boolean(driver)}
            bookingStatus={item.status}
          />
        </>
      ) : null}
    </main>
  );
}
