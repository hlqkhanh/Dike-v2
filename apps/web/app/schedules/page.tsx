"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowRightLeft,
  CalendarDays,
  CalendarPlus,
  ChevronRight,
  Clock3,
  Globe2,
  Lock,
  MapPin,
  Route,
} from "lucide-react";

import { scheduleApi } from "../../src/schedules/api";
import { EmptyState, ErrorState, LoadingState } from "../components/app-ui";

const directionName = (value: string) =>
  value === "RETURN" ? "Lượt về" : "Lượt đi";

const commitmentName = (value: string) =>
  value === "PUBLISHED"
    ? "Đã đăng"
    : value === "PRIVATE"
      ? "Riêng tư"
      : value === "BOOKED"
        ? "Đã ghép"
        : value;

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
    <main className="schedule-timeline-page">
      <header className="schedule-timeline-hero">
        <div className="schedule-timeline-copy">
          <p>Kế hoạch di chuyển</p>
          <h1>Lịch trình của tôi</h1>
          <span>
            Lưu lịch đi lại thường xuyên để Diké chủ động gợi ý chuyến phù hợp
            trong 14 ngày tới.
          </span>
        </div>
        <div className="schedule-timeline-art" aria-hidden="true">
          <i className="schedule-art-pin is-one" />
          <i className="schedule-art-pin is-two" />
          <b />
        </div>
        <Link className="schedule-timeline-create" href="/schedules/new">
          <CalendarPlus aria-hidden="true" size={20} /> Tạo lịch trình
        </Link>
      </header>

      <section className="schedule-intent-section">
        <div className="schedule-timeline-heading">
          <div>
            <p>Tự động đề xuất</p>
            <h2>Nhu cầu 14 ngày tới</h2>
          </div>
          <span>
            <CalendarDays aria-hidden="true" size={19} />
            {intents.data?.length ?? 0} lịch dự kiến
          </span>
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
        <div className="schedule-timeline-list">
          {intents.data?.map((intent) => {
            const intentDate = new Date(`${intent.localDate}T00:00:00`);
            return (
              <article className="schedule-timeline-row" key={intent.id}>
                <span className="schedule-timeline-node" aria-hidden="true" />
                <time dateTime={intent.localDate}>
                  <strong>{intentDate.getDate()}</strong>
                  <small>Tháng {intentDate.getMonth() + 1}</small>
                </time>
                <Link href={`/travel-intents/${encodeURIComponent(intent.id)}`}>
                  <span className="schedule-timeline-route-icon">
                    <MapPin aria-hidden="true" size={21} />
                    <MapPin aria-hidden="true" size={17} />
                  </span>
                  <span className="schedule-timeline-row-copy">
                    <strong>
                      {intent.origin.displayLabel} →{" "}
                      {intent.destination.displayLabel}
                    </strong>
                    <span>
                      <small>
                        <CalendarDays aria-hidden="true" size={15} />
                        {intent.localDate}
                      </small>
                      <small>
                        <ArrowRightLeft aria-hidden="true" size={15} />
                        {directionName(intent.direction)}
                      </small>
                      <small>
                        {intent.commitmentState === "PUBLISHED" ? (
                          <Globe2 aria-hidden="true" size={15} />
                        ) : (
                          <Lock aria-hidden="true" size={15} />
                        )}
                        {commitmentName(intent.commitmentState)}
                      </small>
                    </span>
                  </span>
                  <ChevronRight aria-hidden="true" size={22} />
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className="saved-schedules-section">
        <div className="schedule-timeline-heading">
          <div>
            <p>Lịch định kỳ</p>
            <h2>Lịch trình đã lưu</h2>
          </div>
          <span>{schedules.data?.length ?? 0} lịch trình</span>
        </div>
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
        <div className="schedule-saved-grid">
          {schedules.data?.map((schedule) => (
            <article className="schedule-saved-card" key={schedule.id}>
              <Link href={`/schedules/${encodeURIComponent(schedule.id)}`}>
                <span>
                  <CalendarDays aria-hidden="true" size={21} />
                </span>
                <div>
                  <small>{schedule.status}</small>
                  <h3>{schedule.name}</h3>
                  <p>
                    <Clock3 aria-hidden="true" size={15} />
                    {schedule.weekdays.join(", ")} · {schedule.startLocalTime}–
                    {schedule.endLocalTime}
                  </p>
                  <p>
                    <MapPin aria-hidden="true" size={15} />
                    {schedule.usualOrigin.displayLabel} →{" "}
                    {schedule.activityPlace.displayLabel}
                  </p>
                </div>
                <ChevronRight aria-hidden="true" size={20} />
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
