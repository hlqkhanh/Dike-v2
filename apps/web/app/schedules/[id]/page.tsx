"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Clock3,
  Eye,
  MapPin,
  Pause,
  Play,
  Route,
  Square,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";

import { scheduleApi } from "../../../src/schedules/api";
import { ErrorState, LoadingState, PageHeader } from "../../components/app-ui";

const weekdayNames: Record<string, string> = {
  MONDAY: "Thứ Hai",
  TUESDAY: "Thứ Ba",
  WEDNESDAY: "Thứ Tư",
  THURSDAY: "Thứ Năm",
  FRIDAY: "Thứ Sáu",
  SATURDAY: "Thứ Bảy",
  SUNDAY: "Chủ Nhật",
};
const statusNames: Record<string, string> = {
  ACTIVE: "Đang hoạt động",
  PAUSED: "Đã tạm dừng",
  ENDED: "Đã kết thúc",
};
const formatDate = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));

export default function ScheduleDetailPage() {
  const id = String(useParams<{ id: string }>().id);
  const router = useRouter();
  const client = useQueryClient();
  const schedule = useQuery({
    queryKey: ["schedules", id],
    queryFn: () => scheduleApi.get(id),
  });
  const change = useMutation({
    mutationFn: (action: "pause" | "resume" | "end") => {
      const current = schedule.data!;
      return action === "end"
        ? scheduleApi.end(id, current.version)
        : scheduleApi.status(id, action, current.version);
    },
    onSuccess: async (updated, action) => {
      client.setQueryData(["schedules", id], updated);
      await client.invalidateQueries({ queryKey: ["schedules"] });
      if (action === "end") router.push("/schedules");
    },
  });

  return (
    <main className="settings-page journey-detail-page">
      <PageHeader
        eyebrow="Kế hoạch di chuyển"
        title={schedule.data?.name ?? "Chi tiết lịch trình"}
        description="Xem lộ trình lặp lại, khung giờ và trạng thái ghép chuyến tự động."
        backHref="/schedules"
        backLabel="Quay lại danh sách lịch"
      />
      {schedule.isPending ? (
        <LoadingState label="Đang tải chi tiết lịch trình" />
      ) : schedule.isError || !schedule.data ? (
        <ErrorState
          message={
            schedule.error instanceof Error
              ? schedule.error.message
              : "Không tìm thấy lịch trình."
          }
          onRetry={() => void schedule.refetch()}
        />
      ) : (
        <div className="journey-detail-layout">
          <section className="journey-detail-main">
            <article className="settings-card journey-route-card">
              <div className="journey-card-heading">
                <span className="journey-heading-icon">
                  <Route aria-hidden="true" size={22} />
                </span>
                <div>
                  <p className="app-eyebrow">Lộ trình thường xuyên</p>
                  <h2>
                    {schedule.data.usualOrigin.displayLabel} →{" "}
                    {schedule.data.activityPlace.displayLabel}
                  </h2>
                </div>
                <span
                  className={`status-pill ${schedule.data.status === "ACTIVE" ? "status-pill--success" : schedule.data.status === "PAUSED" ? "status-pill--warning" : "status-pill--neutral"}`}
                >
                  {statusNames[schedule.data.status] ?? schedule.data.status}
                </span>
              </div>
              <div className="journey-route-line">
                <span>
                  <i />
                </span>
                <div>
                  <small>Điểm xuất phát</small>
                  <strong>{schedule.data.usualOrigin.displayLabel}</strong>
                </div>
                <span>
                  <i />
                </span>
                <div>
                  <small>Địa điểm hoạt động</small>
                  <strong>{schedule.data.activityPlace.displayLabel}</strong>
                </div>
              </div>
            </article>

            {schedule.data.warnings.length > 0 ? (
              <div className="schedule-conflict-notice" role="alert">
                <CalendarDays aria-hidden="true" size={21} />
                <div>
                  <strong>Lịch trình đang bị trùng</strong>
                  <p>
                    Phát hiện {schedule.data.warnings.length} lịch khác có thời
                    gian xung đột. Hãy kiểm tra trước khi xác nhận chuyến.
                  </p>
                </div>
              </div>
            ) : null}

            <section className="settings-card journey-actions-card">
              <div className="section-heading">
                <div>
                  <p className="app-eyebrow">Trạng thái</p>
                  <h2>Quản lý lịch trình</h2>
                </div>
              </div>
              <p className="journey-section-copy">
                Tạm dừng khi bạn chưa cần gợi ý chuyến, hoặc kết thúc nếu không
                còn sử dụng lịch này.
              </p>
              <div className="journey-action-row">
                {schedule.data.status === "ACTIVE" ? (
                  <button
                    className="app-button app-button--secondary"
                    disabled={change.isPending}
                    onClick={() => change.mutate("pause")}
                  >
                    <Pause aria-hidden="true" size={17} /> Tạm dừng
                  </button>
                ) : null}
                {schedule.data.status === "PAUSED" ? (
                  <button
                    className="app-button app-button--primary"
                    disabled={change.isPending}
                    onClick={() => change.mutate("resume")}
                  >
                    <Play aria-hidden="true" size={17} /> Tiếp tục
                  </button>
                ) : null}
                {schedule.data.status !== "ENDED" ? (
                  <button
                    className="app-button app-button--danger"
                    disabled={change.isPending}
                    onClick={() => change.mutate("end")}
                  >
                    <Square aria-hidden="true" size={16} /> Kết thúc lịch
                  </button>
                ) : null}
              </div>
              {change.isPending ? (
                <p className="form-hint" role="status">
                  Đang cập nhật lịch…
                </p>
              ) : null}
              {change.isSuccess ? (
                <p className="success-notice" role="status">
                  Lịch trình đã được cập nhật.
                </p>
              ) : null}
              {change.isError ? (
                <p role="alert">{change.error.message}</p>
              ) : null}
            </section>
          </section>

          <aside
            className="settings-card journey-facts-card"
            aria-label="Thông tin lịch trình"
          >
            <h2>Thông tin lịch</h2>
            <dl className="journey-fact-list">
              <div>
                <dt>
                  <CalendarDays aria-hidden="true" size={18} /> Ngày lặp lại
                </dt>
                <dd>
                  {schedule.data.weekdays
                    .map((day) => weekdayNames[day] ?? day)
                    .join(", ")}
                </dd>
              </div>
              <div>
                <dt>
                  <Clock3 aria-hidden="true" size={18} /> Khung giờ
                </dt>
                <dd>
                  {schedule.data.startLocalTime}–{schedule.data.endLocalTime}
                </dd>
              </div>
              <div>
                <dt>
                  <CalendarDays aria-hidden="true" size={18} /> Hiệu lực
                </dt>
                <dd>
                  {formatDate(schedule.data.effectiveFrom)} –{" "}
                  {formatDate(schedule.data.effectiveUntil)}
                </dd>
              </div>
              <div>
                <dt>
                  <Route aria-hidden="true" size={18} /> Vai trò mặc định
                </dt>
                <dd>{schedule.data.defaultTravelRole}</dd>
              </div>
              <div>
                <dt>
                  <Eye aria-hidden="true" size={18} /> Phạm vi hiển thị
                </dt>
                <dd>{schedule.data.visibility}</dd>
              </div>
              <div>
                <dt>
                  <MapPin aria-hidden="true" size={18} /> Thời gian đệm
                </dt>
                <dd>{schedule.data.arrivalBufferMinutes} phút</dd>
              </div>
            </dl>
          </aside>
        </div>
      )}
    </main>
  );
}
