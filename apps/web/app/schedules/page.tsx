"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  CalendarDays,
  CalendarPlus,
  Clock3,
  MapPin,
  Route,
} from "lucide-react";

import { scheduleApi } from "../../src/schedules/api";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "../components/app-ui";

export default function SchedulesPage() {
  const schedules = useQuery({
    queryKey: ["schedules"],
    queryFn: scheduleApi.list,
  });
  const today = new Date();
  const through = new Date(today);
  through.setDate(through.getDate() + 14);
  const date = (value: Date) => value.toISOString().slice(0, 10);
  const intents = useQuery({
    queryKey: ["travel-intents", date(today), date(through)],
    queryFn: () => scheduleApi.intents(date(today), date(through)),
  });

  return (
    <main className="settings-page schedules-page">
      <PageHeader
        eyebrow="Kế hoạch di chuyển"
        title="Lịch trình của tôi"
        description="Lưu lịch đi lại thường xuyên để Diké chủ động gợi ý chuyến phù hợp trong 14 ngày tới."
        actions={
          <Link
            className="app-button app-button--primary"
            href="/schedules/new"
          >
            <CalendarPlus aria-hidden="true" size={18} /> Tạo lịch trình
          </Link>
        }
      />
      {schedules.isPending ? <LoadingState label="Đang tải lịch" /> : null}
      {schedules.isError ? (
        <ErrorState
          message="Không thể tải lịch. Hãy thử lại."
          onRetry={() => void schedules.refetch()}
        />
      ) : null}
      {schedules.data?.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Chưa có lịch trình"
          description="Tạo lịch đi làm, đi học hoặc hoạt động hằng tuần để Diké tìm người đi cùng phù hợp."
          action={
            <Link
              className="app-button app-button--primary"
              href="/schedules/new"
            >
              <CalendarPlus aria-hidden="true" size={18} /> Tạo lịch đầu tiên
            </Link>
          }
        />
      ) : null}
      <div className="schedule-grid">
        {schedules.data?.map((schedule) => (
          <article className="settings-card schedule-card" key={schedule.id}>
            <span className="schedule-icon">
              <CalendarDays aria-hidden="true" size={21} />
            </span>
            <span className="status-pill status-pill--neutral">
              {schedule.status}
            </span>
            <h2>
              <Link href={`/schedules/${encodeURIComponent(schedule.id)}`}>
                {schedule.name}
              </Link>
            </h2>
            <p className="schedule-meta">
              <Clock3 aria-hidden="true" size={16} />
              {schedule.weekdays.join(", ")} · {schedule.startLocalTime}–
              {schedule.endLocalTime}
            </p>
            <p className="schedule-meta">
              <MapPin aria-hidden="true" size={16} />
              {schedule.usualOrigin.displayLabel} →{" "}
              {schedule.activityPlace.displayLabel}
            </p>
          </article>
        ))}
      </div>
      <section className="upcoming-intents">
        <div className="section-heading">
          <div>
            <p className="app-eyebrow">Tự động đề xuất</p>
            <h2>Nhu cầu 14 ngày tới</h2>
          </div>
          <span>{intents.data?.length ?? 0} lịch dự kiến</span>
        </div>
        {intents.isPending ? <LoadingState label="Đang tải nhu cầu" /> : null}
        {intents.isError ? (
          <ErrorState
            message="Không thể tải nhu cầu di chuyển."
            onRetry={() => void intents.refetch()}
          />
        ) : null}
        {intents.data?.length === 0 ? (
          <EmptyState
            icon={Route}
            title="Chưa có nhu cầu được sinh"
            description="Các hành trình dự kiến sẽ xuất hiện sau khi lịch trình của bạn được kích hoạt."
          />
        ) : null}
        {intents.data?.map((intent) => (
          <article className="settings-card intent-row" key={intent.id}>
            <span className="intent-date">
              <strong>{new Date(intent.localDate).getDate()}</strong>
              <small>Tháng {new Date(intent.localDate).getMonth() + 1}</small>
            </span>
            <div>
              <h3>
                <Link href={`/travel-intents/${encodeURIComponent(intent.id)}`}>
                  {intent.origin.displayLabel} →{" "}
                  {intent.destination.displayLabel}
                </Link>
              </h3>
              <p>
                {intent.localDate} · {intent.direction} ·{" "}
                {intent.commitmentState}
              </p>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
