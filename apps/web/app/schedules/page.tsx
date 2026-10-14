"use client";

import { useMemo, useState } from "react";
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
  Search,
} from "lucide-react";

import { scheduleApi } from "../../src/schedules/api";
import { EmptyState, ErrorState, LoadingState } from "../components/app-ui";

type ScheduleTab = "upcoming" | "recurring";
type IntentFilter = "ALL" | "OUTBOUND" | "RETURN" | "PUBLISHED" | "PRIVATE";

const PAGE_SIZE = 6;
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
const scheduleStatusName = (value: string) =>
  value === "ACTIVE"
    ? "Đang hoạt động"
    : value === "PAUSED"
      ? "Tạm dừng"
      : value === "ENDED"
        ? "Đã kết thúc"
        : value;
const departureTime = (value?: string | null, fallback?: string | null) => {
  const candidate = value || fallback;
  if (!candidate) return "Chưa đặt";
  return candidate.match(/T(\d{2}:\d{2})/)?.[1] ?? candidate.slice(0, 5);
};

export default function SchedulesPage() {
  const [activeTab, setActiveTab] = useState<ScheduleTab>("upcoming");
  const [intentFilter, setIntentFilter] = useState<IntentFilter>("ALL");
  const [visibleIntentCount, setVisibleIntentCount] = useState(PAGE_SIZE);
  const [scheduleSearch, setScheduleSearch] = useState("");

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

  const filteredIntents = useMemo(() => {
    const values = intents.data ?? [];
    if (intentFilter === "ALL") return values;
    if (intentFilter === "OUTBOUND" || intentFilter === "RETURN") {
      return values.filter((intent) => intent.direction === intentFilter);
    }
    return values.filter((intent) => intent.commitmentState === intentFilter);
  }, [intentFilter, intents.data]);

  const visibleIntents = filteredIntents.slice(0, visibleIntentCount);
  const groupedIntents = useMemo(
    () =>
      visibleIntents.reduce<
        Array<{ date: string; items: typeof visibleIntents }>
      >((groups, intent) => {
        const lastGroup = groups.at(-1);
        if (lastGroup?.date === intent.localDate) lastGroup.items.push(intent);
        else groups.push({ date: intent.localDate, items: [intent] });
        return groups;
      }, []),
    [visibleIntents],
  );

  const filteredSchedules = useMemo(() => {
    const query = scheduleSearch.trim().toLocaleLowerCase("vi");
    if (!query) return schedules.data ?? [];
    return (schedules.data ?? []).filter((schedule) =>
      [
        schedule.name,
        schedule.usualOrigin.displayLabel,
        schedule.activityPlace.displayLabel,
      ].some((value) => value.toLocaleLowerCase("vi").includes(query)),
    );
  }, [scheduleSearch, schedules.data]);

  const setFilter = (filter: IntentFilter) => {
    setIntentFilter(filter);
    setVisibleIntentCount(PAGE_SIZE);
  };

  return (
    <main className="schedule-timeline-page">
      <header className="schedule-timeline-hero schedule-timeline-hero--compact">
        <div className="schedule-timeline-copy">
          <p>Kế hoạch di chuyển</p>
          <h1>Lịch trình của tôi</h1>
          <span>
            {intents.data?.length ?? 0} chuyến sắp tới ·{" "}
            {schedules.data?.length ?? 0} lịch định kỳ
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

      <section className="schedule-workspace">
        <div
          className="schedule-tabs"
          role="tablist"
          aria-label="Loại lịch trình"
        >
          <button
            aria-selected={activeTab === "upcoming"}
            className={activeTab === "upcoming" ? "is-active" : ""}
            onClick={() => setActiveTab("upcoming")}
            role="tab"
            type="button"
          >
            Sắp tới <span>{intents.data?.length ?? 0}</span>
          </button>
          <button
            aria-selected={activeTab === "recurring"}
            className={activeTab === "recurring" ? "is-active" : ""}
            onClick={() => setActiveTab("recurring")}
            role="tab"
            type="button"
          >
            Lịch định kỳ <span>{schedules.data?.length ?? 0}</span>
          </button>
        </div>

        {activeTab === "upcoming" ? (
          <div className="schedule-panel" role="tabpanel">
            <div className="schedule-panel-heading">
              <div>
                <p>Tự động đề xuất</p>
                <h2>Nhu cầu 14 ngày tới</h2>
              </div>
              <div
                className="schedule-filter-chips"
                aria-label="Lọc lịch sắp tới"
              >
                {(
                  [
                    ["ALL", "Tất cả"],
                    ["OUTBOUND", "Lượt đi"],
                    ["RETURN", "Lượt về"],
                    ["PUBLISHED", "Đã đăng"],
                    ["PRIVATE", "Riêng tư"],
                  ] as Array<[IntentFilter, string]>
                ).map(([value, label]) => (
                  <button
                    className={intentFilter === value ? "is-active" : ""}
                    key={value}
                    onClick={() => setFilter(value)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {intents.isPending ? (
              <LoadingState label="Đang tải nhu cầu" />
            ) : null}
            {intents.isError ? (
              <ErrorState
                message="Không thể tải nhu cầu di chuyển."
                onRetry={() => void intents.refetch()}
              />
            ) : null}
            {!intents.isPending && filteredIntents.length === 0 ? (
              <EmptyState
                icon={Route}
                title={
                  intentFilter === "ALL"
                    ? "Chưa có nhu cầu được sinh"
                    : "Không có lịch phù hợp"
                }
                description="Thử chọn bộ lọc khác hoặc tạo một lịch trình định kỳ mới."
              />
            ) : null}

            <div className="schedule-day-groups">
              {groupedIntents.map((group) => {
                const intentDate = new Date(`${group.date}T00:00:00`);
                return (
                  <section className="schedule-day-group" key={group.date}>
                    <div className="schedule-day-label">
                      <strong>
                        {intentDate.toLocaleDateString("vi-VN", {
                          weekday: "long",
                        })}
                      </strong>
                      <span className="schedule-date-badge">
                        <b>{String(intentDate.getDate()).padStart(2, "0")}</b>
                        <small>Tháng {intentDate.getMonth() + 1}</small>
                      </span>
                    </div>
                    <div className="schedule-compact-list">
                      {group.items.map((intent) => (
                        <Link
                          className="schedule-compact-row"
                          href={`/travel-intents/${encodeURIComponent(intent.id)}`}
                          key={intent.id}
                        >
                          <time
                            dateTime={intent.earliestDepartureAt || undefined}
                          >
                            {departureTime(
                              intent.earliestDepartureAt,
                              intent.arrivalDeadlineAt,
                            )}
                          </time>
                          <span className="schedule-compact-route">
                            <strong>
                              {intent.origin.displayLabel} →{" "}
                              {intent.destination.displayLabel}
                            </strong>
                            <small>
                              <ArrowRightLeft aria-hidden="true" size={14} />
                              {directionName(intent.direction)}
                            </small>
                          </span>
                          <span
                            className={`schedule-state schedule-state--${intent.commitmentState.toLowerCase()}`}
                          >
                            {intent.commitmentState === "PUBLISHED" ? (
                              <Globe2 aria-hidden="true" size={14} />
                            ) : (
                              <Lock aria-hidden="true" size={14} />
                            )}
                            {commitmentName(intent.commitmentState)}
                          </span>
                          <ChevronRight aria-hidden="true" size={19} />
                        </Link>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>

            {visibleIntentCount < filteredIntents.length ? (
              <button
                className="schedule-load-more"
                onClick={() =>
                  setVisibleIntentCount((count) => count + PAGE_SIZE)
                }
                type="button"
              >
                Xem thêm{" "}
                {Math.min(
                  PAGE_SIZE,
                  filteredIntents.length - visibleIntentCount,
                )}{" "}
                chuyến
              </button>
            ) : null}
          </div>
        ) : (
          <div className="schedule-panel" role="tabpanel">
            <div className="schedule-panel-heading schedule-panel-heading--search">
              <div>
                <p>Lịch đã lưu</p>
                <h2>Lịch trình định kỳ</h2>
              </div>
              <label className="schedule-search">
                <Search aria-hidden="true" size={17} />
                <input
                  aria-label="Tìm lịch trình"
                  onChange={(event) => setScheduleSearch(event.target.value)}
                  placeholder="Tìm tên hoặc địa điểm"
                  type="search"
                  value={scheduleSearch}
                />
              </label>
            </div>

            {schedules.isPending ? (
              <LoadingState label="Đang tải lịch" />
            ) : null}
            {schedules.isError ? (
              <ErrorState
                message="Không thể tải lịch. Hãy thử lại."
                onRetry={() => void schedules.refetch()}
              />
            ) : null}
            {!schedules.isPending && filteredSchedules.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title={
                  scheduleSearch
                    ? "Không tìm thấy lịch trình"
                    : "Chưa có lịch trình"
                }
                description={
                  scheduleSearch
                    ? "Thử tìm bằng tên hoặc địa điểm khác."
                    : "Tạo lịch đi làm, đi học hoặc hoạt động hằng tuần để Diké tìm người đi cùng phù hợp."
                }
                action={
                  !scheduleSearch ? (
                    <Link
                      className="app-button app-button--primary"
                      href="/schedules/new"
                    >
                      <CalendarPlus aria-hidden="true" size={18} /> Tạo lịch đầu
                      tiên
                    </Link>
                  ) : undefined
                }
              />
            ) : null}
            <div className="schedule-saved-grid schedule-saved-grid--compact">
              {filteredSchedules.map((schedule) => (
                <article className="schedule-saved-card" key={schedule.id}>
                  <Link href={`/schedules/${encodeURIComponent(schedule.id)}`}>
                    <span>
                      <CalendarDays aria-hidden="true" size={21} />
                    </span>
                    <div>
                      <small>{scheduleStatusName(schedule.status)}</small>
                      <h3>{schedule.name}</h3>
                      <p>
                        <Clock3 aria-hidden="true" size={15} />
                        {schedule.weekdays.join(", ")} ·{" "}
                        {schedule.startLocalTime}–{schedule.endLocalTime}
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
          </div>
        )}
      </section>
    </main>
  );
}
