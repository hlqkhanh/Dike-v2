"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  CircleDollarSign,
  Handshake,
  UserRound,
} from "lucide-react";
import Link from "next/link";

import {
  ErrorState,
  LoadingState,
  PageHeader,
} from "../../app/components/app-ui";
import { authApi } from "../auth/api";
import { useAuthFailure } from "../auth/use-auth-failure";
import { rideApi } from "./api";
import {
  dateTime,
  money,
  RideNav,
  statusName,
  useRideCommand,
} from "./dashboard";

export function ProposalDetail({ id }: { id: string }) {
  const proposal = useQuery({
    queryKey: ["rides", "proposal", id],
    queryFn: () => rideApi.proposal(id),
    retry: false,
  });
  const session = useQuery({
    queryKey: ["auth", "session"],
    queryFn: authApi.session,
  });
  const command = useRideCommand();
  useAuthFailure(proposal.error);
  const item = proposal.data;
  const recipient = item?.recipientId === session.data?.user.id;
  const act = (action: "accept" | "reject" | "withdraw") => {
    if (!item) return;
    command.mutate({
      signature: `proposal:${item.id}:${item.version}:${action}`,
      run: (key) =>
        action === "accept"
          ? rideApi.accept(item.id, item.version, key)
          : rideApi.decide(item.id, action, item.version, key),
    });
  };

  return (
    <main className="settings-page journey-detail-page">
      <PageHeader
        eyebrow="Kết nối chuyến"
        title="Chi tiết đề nghị"
        description="Xem thời gian, mức đóng góp và phản hồi lời mời đi cùng."
        backHref="/proposals"
        backLabel="Quay lại danh sách đề nghị"
      />
      <RideNav />
      {proposal.isPending ? <LoadingState label="Đang tải đề nghị" /> : null}
      {proposal.isError ? (
        <ErrorState
          message={proposal.error.message}
          onRetry={() => void proposal.refetch()}
        />
      ) : null}
      {item ? (
        <div className="journey-detail-layout">
          <section className="journey-detail-main">
            <article className="settings-card journey-route-card">
              <div className="journey-card-heading">
                <span className="journey-heading-icon">
                  <Handshake aria-hidden="true" size={22} />
                </span>
                <div>
                  <p className="app-eyebrow">
                    {recipient ? "Đề nghị nhận được" : "Đề nghị đã gửi"}
                  </p>
                  <h2>Yêu cầu đi cùng chuyến</h2>
                </div>
                <span
                  className={`ride-status ride-status--${item.status.toLowerCase()}`}
                >
                  {statusName(item.status)}
                </span>
              </div>
              <div className="proposal-time-grid">
                <div>
                  <small>Thời gian đón</small>
                  <strong>{dateTime(item.pickupAt)}</strong>
                </div>
                <div>
                  <small>Thời gian trả</small>
                  <strong>{dateTime(item.dropoffAt)}</strong>
                </div>
              </div>
              <Link
                className="app-inline-link"
                href={`/trips/${encodeURIComponent(item.tripId)}`}
              >
                Xem chuyến liên quan
              </Link>
            </article>
            {item.status === "PENDING" ? (
              <section className="settings-card journey-actions-card">
                <div className="section-heading">
                  <div>
                    <p className="app-eyebrow">Phản hồi</p>
                    <h2>
                      {recipient ? "Xử lý đề nghị" : "Quản lý đề nghị đã gửi"}
                    </h2>
                  </div>
                </div>
                <div className="journey-action-row">
                  {recipient ? (
                    <>
                      <button
                        className="app-button app-button--primary"
                        disabled={command.isPending}
                        onClick={() => act("accept")}
                      >
                        Chấp nhận
                      </button>
                      <button
                        className="app-button app-button--danger"
                        disabled={command.isPending}
                        onClick={() => act("reject")}
                      >
                        Từ chối
                      </button>
                    </>
                  ) : (
                    <button
                      className="app-button app-button--danger"
                      disabled={command.isPending}
                      onClick={() => act("withdraw")}
                    >
                      Rút đề nghị
                    </button>
                  )}
                </div>
                {command.isPending ? (
                  <p className="form-hint" role="status">
                    Đang xử lý đề nghị…
                  </p>
                ) : null}
                {command.isSuccess ? (
                  <p className="success-notice" role="status">
                    Đã xử lý đề nghị. <Link href="/bookings">Xem booking</Link>
                  </p>
                ) : null}
                {command.isError ? (
                  <p role="alert">{command.error.message}</p>
                ) : null}
              </section>
            ) : null}
          </section>
          <aside
            className="settings-card journey-facts-card"
            aria-label="Thông tin đề nghị"
          >
            <h2>Thông tin đề nghị</h2>
            <dl className="journey-fact-list">
              <div>
                <dt>
                  <CircleDollarSign aria-hidden="true" size={18} /> Mức đóng góp
                </dt>
                <dd>{money(item.priceVnd)}</dd>
              </div>
              <div>
                <dt>
                  <CalendarClock aria-hidden="true" size={18} /> Hiệu lực đến
                </dt>
                <dd>{dateTime(item.expiresAt)}</dd>
              </div>
              <div>
                <dt>
                  <UserRound aria-hidden="true" size={18} /> Vai trò của bạn
                </dt>
                <dd>{recipient ? "Người nhận" : "Người gửi"}</dd>
              </div>
            </dl>
          </aside>
        </div>
      ) : null}
    </main>
  );
}
