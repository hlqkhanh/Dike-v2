"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { scheduleApi } from "../../src/schedules/api";

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
    <main className="settings-page">
      <p className="eyebrow">Kế hoạch di chuyển</p>
      <h1>Lịch trình của tôi</h1>
      <Link className="stage-badge stage-badge--cta" href="/schedules/new">
        Tạo lịch trình
      </Link>
      {schedules.isPending ? <p role="status">Đang tải lịch…</p> : null}
      {schedules.isError ? (
        <p role="alert">Không thể tải lịch. Hãy thử lại.</p>
      ) : null}
      {schedules.data?.length === 0 ? (
        <p>
          Chưa có lịch trình. Tạo lịch để Dike sinh nhu cầu di chuyển phù hợp.
        </p>
      ) : null}
      <div className="verification-grid">
        {schedules.data?.map((schedule) => (
          <article className="settings-card" key={schedule.id}>
            <span className="status-pill status-pill--neutral">
              {schedule.status}
            </span>
            <h2>
              <Link href={`/schedules/${encodeURIComponent(schedule.id)}`}>
                {schedule.name}
              </Link>
            </h2>
            <p>
              {schedule.weekdays.join(", ")} · {schedule.startLocalTime}–
              {schedule.endLocalTime}
            </p>
            <p>
              {schedule.usualOrigin.displayLabel} →{" "}
              {schedule.activityPlace.displayLabel}
            </p>
          </article>
        ))}
      </div>
      <h2>Nhu cầu 14 ngày tới</h2>
      {intents.isPending ? <p role="status">Đang tải nhu cầu…</p> : null}
      {intents.isError ? (
        <p role="alert">Không thể tải nhu cầu di chuyển.</p>
      ) : null}
      {intents.data?.length === 0 ? (
        <p>Chưa có nhu cầu nào được sinh.</p>
      ) : null}
      {intents.data?.map((intent) => (
        <article className="settings-card" key={intent.id}>
          <h3>
            <Link href={`/travel-intents/${encodeURIComponent(intent.id)}`}>
              {intent.origin.displayLabel} → {intent.destination.displayLabel}
            </Link>
          </h3>
          <p>
            {intent.localDate} · {intent.direction} · {intent.commitmentState}
          </p>
        </article>
      ))}
    </main>
  );
}
