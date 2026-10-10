"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Clock3,
  MapPin,
  Route,
  Search,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { scheduleApi } from "../../../src/schedules/api";
import { ErrorState, LoadingState, PageHeader } from "../../components/app-ui";

const labels: Record<string, string> = {
  DRIVER: "Tài xế",
  PASSENGER: "Hành khách",
  OUTBOUND: "Lượt đi",
  RETURN: "Lượt về",
  PLANNED: "Đã lên kế hoạch",
  MATCHING: "Đang tìm chuyến",
  MATCHED: "Đã ghép chuyến",
  CANCELLED: "Đã hủy",
};
const formatDateTime = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Chưa thiết lập";

export default function TravelIntentDetailPage() {
  const id = String(useParams<{ id: string }>().id);
  const client = useQueryClient();
  const intent = useQuery({
    queryKey: ["travel-intents", id],
    queryFn: () => scheduleApi.intent(id),
  });
  const match = useMutation({
    mutationFn: () => scheduleApi.matchIntent(id),
    onSuccess: (updated) =>
      client.setQueryData(["travel-intents", id], updated),
  });

  return (
    <main className="settings-page journey-detail-page">
      <PageHeader
        eyebrow="Nhu cầu di chuyển"
        title="Chi tiết nhu cầu"
        description="Kiểm tra thời gian, vai trò và yêu cầu Diké tìm chuyến phù hợp."
        backHref="/schedules"
        backLabel="Quay lại lịch trình"
      />
      {intent.isPending ? (
        <LoadingState label="Đang tải nhu cầu di chuyển" />
      ) : null}
      {intent.isError || (!intent.isPending && !intent.data) ? (
        <ErrorState
          message={
            intent.error instanceof Error
              ? intent.error.message
              : "Không tìm thấy nhu cầu."
          }
          onRetry={() => void intent.refetch()}
        />
      ) : null}
      {intent.data ? (
        <div className="journey-detail-layout">
          <section className="journey-detail-main">
            <article className="settings-card journey-route-card">
              <div className="journey-card-heading">
                <span className="journey-heading-icon">
                  <Route aria-hidden="true" size={22} />
                </span>
                <div>
                  <p className="app-eyebrow">Lộ trình dự kiến</p>
                  <h2>
                    {intent.data.origin.displayLabel} →{" "}
                    {intent.data.destination.displayLabel}
                  </h2>
                </div>
                <span
                  className={`status-pill ${intent.data.commitmentState === "MATCHED" ? "status-pill--success" : "status-pill--neutral"}`}
                >
                  {labels[intent.data.commitmentState] ??
                    intent.data.commitmentState}
                </span>
              </div>
              <div className="journey-route-line">
                <span>
                  <i />
                </span>
                <div>
                  <small>Xuất phát</small>
                  <strong>{intent.data.origin.displayLabel}</strong>
                </div>
                <span>
                  <i />
                </span>
                <div>
                  <small>Điểm đến</small>
                  <strong>{intent.data.destination.displayLabel}</strong>
                </div>
              </div>
            </article>
            <section className="settings-card journey-actions-card">
              <div className="section-heading">
                <div>
                  <p className="app-eyebrow">Ghép chuyến</p>
                  <h2>Tìm người đi cùng</h2>
                </div>
              </div>
              <p className="journey-section-copy">
                Yêu cầu ghép chuyến từ nhu cầu này, hoặc tạo bài đăng để chủ
                động kết nối.
              </p>
              <div className="journey-action-row">
                <button
                  className="app-button app-button--primary"
                  disabled={match.isPending}
                  onClick={() => match.mutate()}
                >
                  <Search aria-hidden="true" size={17} />{" "}
                  {match.isPending ? "Đang tìm chuyến…" : "Yêu cầu ghép chuyến"}
                </button>
                <Link
                  className="app-button app-button--secondary"
                  href={`/feed/new?intent=${encodeURIComponent(intent.data.id)}`}
                >
                  Tạo bài đăng
                </Link>
              </div>
              {match.isSuccess ? (
                <p className="success-notice" role="status">
                  Yêu cầu ghép chuyến đã được ghi nhận.
                </p>
              ) : null}
              {match.isError ? <p role="alert">{match.error.message}</p> : null}
            </section>
          </section>
          <aside
            className="settings-card journey-facts-card"
            aria-label="Thông tin nhu cầu"
          >
            <h2>Thông tin nhu cầu</h2>
            <dl className="journey-fact-list">
              <div>
                <dt>
                  <CalendarDays aria-hidden="true" size={18} /> Ngày di chuyển
                </dt>
                <dd>
                  {new Intl.DateTimeFormat("vi-VN", {
                    dateStyle: "long",
                  }).format(new Date(`${intent.data.localDate}T00:00:00`))}
                </dd>
              </div>
              <div>
                <dt>
                  <Clock3 aria-hidden="true" size={18} /> Khởi hành sớm nhất
                </dt>
                <dd>{formatDateTime(intent.data.earliestDepartureAt)}</dd>
              </div>
              <div>
                <dt>
                  <Clock3 aria-hidden="true" size={18} /> Hạn đến nơi
                </dt>
                <dd>{formatDateTime(intent.data.arrivalDeadlineAt)}</dd>
              </div>
              <div>
                <dt>
                  <UserRound aria-hidden="true" size={18} /> Vai trò
                </dt>
                <dd>
                  {labels[intent.data.travelRole] ?? intent.data.travelRole}
                </dd>
              </div>
              <div>
                <dt>
                  <Route aria-hidden="true" size={18} /> Chiều di chuyển
                </dt>
                <dd>
                  {labels[intent.data.direction] ?? intent.data.direction}
                </dd>
              </div>
              <div>
                <dt>
                  <MapPin aria-hidden="true" size={18} /> Nguồn
                </dt>
                <dd>
                  {intent.data.sourceType === "SCHEDULE"
                    ? "Lịch trình tự động"
                    : "Tạo thủ công"}
                </dd>
              </div>
            </dl>
            {intent.data.scheduleId ? (
              <Link
                className="app-inline-link"
                href={`/schedules/${encodeURIComponent(intent.data.scheduleId)}`}
              >
                Xem lịch trình nguồn
              </Link>
            ) : null}
          </aside>
        </div>
      ) : null}
    </main>
  );
}
