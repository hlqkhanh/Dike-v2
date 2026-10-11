"use client";

import {
  ApiError,
  type AuditLogView,
  type ReportView,
} from "@dike/api-client-ts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ExternalLink,
  History,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
  UnlockKeyhole,
  UserRoundCheck,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { authApi } from "../../../../src/auth/api";
import { journeyApi } from "../../../../src/journey/api";
import {
  ErrorState,
  LoadingState,
  PageHeader,
} from "../../../components/app-ui";

const statusLabels: Record<string, string> = {
  RECEIVED: "Mới tiếp nhận",
  TRIAGED: "Đã phân loại",
  IN_REVIEW: "Đang xem xét",
  RESOLVED: "Đã giải quyết",
  DISMISSED: "Đã bác bỏ",
};
const reasonLabels: Record<string, string> = {
  SPAM: "Spam",
  HARASSMENT: "Quấy rối",
  UNSAFE: "Không an toàn",
  MISLEADING: "Thông tin sai lệch",
  HATEFUL_CONTENT: "Nội dung thù ghét",
  PRIVACY: "Quyền riêng tư",
  PAYMENT_DISAGREEMENT: "Tranh chấp chi phí",
  OTHER: "Khác",
};
const priorityLabels: Record<string, string> = {
  P0: "Khẩn cấp",
  P1: "Ưu tiên cao",
  P2: "Thông thường",
  P3: "Ưu tiên thấp",
};
const actionLabels: Record<string, string> = {
  REPORT_CREATED: "Báo cáo được tạo",
  REPORT_CLAIMED: "Nhận xử lý báo cáo",
  REPORT_ASSIGNED: "Phân công người xử lý",
  REPORT_PRIORITY_CHANGED: "Thay đổi mức ưu tiên",
  REPORT_TRANSITIONED: "Cập nhật trạng thái báo cáo",
  ACCOUNT_LOCKED: "Khóa tài khoản",
  ACCOUNT_UNLOCKED: "Mở khóa tài khoản",
};

type ReportAction =
  | { type: "claim" }
  | { type: "priority"; priority: string }
  | { type: "assign"; userId: string }
  | { type: "transition"; status: string; code: string; note: string }
  | { type: "enforce"; locked: boolean; userId: string; reason: string };

export default function AdminReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const client = useQueryClient();
  const [note, setNote] = useState("");
  const [resolutionCode, setResolutionCode] = useState("POLICY_VIOLATION");
  const [assignee, setAssignee] = useState("");
  const [enforcementReason, setEnforcementReason] = useState("");
  const [confirmAction, setConfirmAction] = useState<ReportAction | null>(null);
  const report = useQuery({
    queryKey: ["admin", "reports", id],
    queryFn: () => journeyApi.adminReport(id),
    retry: false,
  });
  const audit = useQuery({
    queryKey: ["admin", "audit"],
    queryFn: () => journeyApi.auditLog(undefined, 100),
    retry: false,
  });
  const session = useQuery({
    queryKey: ["auth", "session"],
    queryFn: authApi.session,
    retry: false,
  });
  const update = useMutation({
    mutationFn: async (action: ReportAction) => {
      const current = report.data!;
      switch (action.type) {
        case "claim":
          return journeyApi.claimReport(id, current.version);
        case "priority":
          return journeyApi.prioritizeReport(
            id,
            action.priority,
            current.version,
          );
        case "assign":
          return journeyApi.assignReport(id, action.userId, current.version);
        case "transition":
          return journeyApi.transitionReport(
            id,
            action.status,
            action.code,
            action.note,
            current.version,
          );
        case "enforce":
          await journeyApi.lockUser(
            action.userId,
            action.locked,
            action.reason,
          );
          return current;
      }
    },
    onSuccess: async (value, action) => {
      client.setQueryData(["admin", "reports", id], value);
      setConfirmAction(null);
      if (action.type === "transition") setNote("");
      if (action.type === "enforce") setEnforcementReason("");
      await Promise.all([
        client.invalidateQueries({ queryKey: ["admin", "reports"] }),
        client.invalidateQueries({ queryKey: ["admin", "audit"] }),
      ]);
    },
    onError: () => setConfirmAction(null),
  });
  const reportAudit = useMemo(
    () =>
      [...(audit.data ?? [])]
        .filter((event) => event.reportId === id || event.targetId === id)
        .sort(
          (left, right) =>
            Date.parse(right.occurredAt) - Date.parse(left.occurredAt),
        ),
    [audit.data, id],
  );

  if (report.isPending)
    return (
      <main className="settings-page">
        <LoadingState label="Đang tải báo cáo" />
      </main>
    );
  if (report.isError || !report.data)
    return (
      <main className="settings-page admin-missing-report">
        <ErrorState
          message="Báo cáo không tồn tại hoặc bạn không còn quyền truy cập."
          onRetry={() => void report.refetch()}
        />
        <Link className="app-button app-button--secondary" href="/admin">
          Trở lại hàng đợi
        </Link>
      </main>
    );

  const value = report.data;
  const terminal = ["RESOLVED", "DISMISSED"].includes(value.status);
  const conflict =
    update.error instanceof ApiError && update.error.status === 409;
  const targetHref = targetLink(value);
  const evidence = Object.entries(value.evidenceSnapshot ?? {});
  const targetIsSelf = value.targetId === session.data?.user.id;

  return (
    <main className="settings-page admin-report-detail">
      <Link className="back-link" href="/admin">
        <ArrowLeft aria-hidden="true" size={17} /> Hàng đợi kiểm duyệt
      </Link>
      <PageHeader
        eyebrow={`Báo cáo ${value.id}`}
        title={reasonLabels[value.reason] ?? value.reason}
        description={`${targetTypeLabel(value.targetType)} · Cập nhật ${dateTime(value.updatedAt)}`}
      />

      {conflict ? (
        <section className="moderation-conflict" role="alert">
          <RefreshCw aria-hidden="true" size={20} />
          <div>
            <strong>Báo cáo vừa được cập nhật ở nơi khác</strong>
            <p>
              Tải phiên bản mới nhất trước khi tiếp tục để không ghi đè quyết
              định của moderator khác.
            </p>
          </div>
          <button
            className="app-button app-button--secondary"
            onClick={() => {
              update.reset();
              void report.refetch();
            }}
          >
            Tải dữ liệu mới
          </button>
        </section>
      ) : null}

      <div className="moderation-detail-grid">
        <div className="moderation-workspace">
          <section className="settings-card moderation-overview-card">
            <div className="moderation-detail-heading">
              <ShieldAlert aria-hidden="true" />
              <div>
                <p>Trạng thái</p>
                <strong>{statusLabels[value.status] ?? value.status}</strong>
              </div>
              <span
                className={`moderation-priority moderation-priority--${value.priority.toLowerCase()}`}
              >
                {value.priority} ·{" "}
                {priorityLabels[value.priority] ?? value.priority}
              </span>
            </div>
            <dl className="moderation-facts">
              <Fact
                label="Người báo cáo"
                value={value.reporterId}
                href={`/users/${encodeURIComponent(value.reporterId)}`}
              />
              <Fact
                label="Đối tượng"
                value={value.targetId}
                href={targetHref}
              />
              <Fact
                label="Người xử lý"
                value={value.assignedTo ?? "Chưa phân công"}
              />
              <Fact label="Tạo lúc" value={dateTime(value.createdAt)} />
              {value.contextBookingId ? (
                <Fact
                  label="Booking liên quan"
                  value={value.contextBookingId}
                  href={`/bookings/${encodeURIComponent(value.contextBookingId)}`}
                />
              ) : null}
              {value.resolvedAt ? (
                <Fact label="Hoàn tất lúc" value={dateTime(value.resolvedAt)} />
              ) : null}
            </dl>
            {value.note ? (
              <InfoBlock title="Mô tả từ người báo cáo" body={value.note} />
            ) : null}
            {value.resolutionNote ? (
              <InfoBlock
                title={`Kết luận · ${value.resolutionCode ?? "Đã xem xét"}`}
                body={value.resolutionNote}
                success
              />
            ) : null}
          </section>

          <section className="settings-card moderation-evidence-card">
            <div className="section-heading">
              <div>
                <p className="app-eyebrow">Dữ liệu chỉ đọc</p>
                <h2>Evidence snapshot</h2>
              </div>
            </div>
            {evidence.length ? (
              <dl>
                {evidence.map(([key, entry]) => (
                  <div key={key}>
                    <dt>{humanize(key)}</dt>
                    <dd>{entry}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="journey-empty-copy">
                Báo cáo này không kèm evidence snapshot.
              </p>
            )}
          </section>

          <AuditTimeline
            events={reportAudit}
            pending={audit.isPending}
            error={audit.isError}
          />
        </div>

        <aside className="settings-card moderation-actions-card">
          <h2>Hành động xử lý</h2>
          <label className="dike-field">
            <span>Mức ưu tiên</span>
            <select
              value={value.priority}
              disabled={update.isPending}
              onChange={(event) =>
                setConfirmAction({
                  type: "priority",
                  priority: event.target.value,
                })
              }
            >
              {Object.entries(priorityLabels).map(([priority, label]) => (
                <option value={priority} key={priority}>
                  {priority} · {label}
                </option>
              ))}
            </select>
          </label>
          <label className="dike-field">
            <span>Phân công moderator</span>
            <input
              value={assignee}
              onChange={(event) => setAssignee(event.target.value)}
              placeholder="Nhập User ID moderator"
            />
          </label>
          <button
            className="app-button app-button--secondary"
            disabled={!assignee.trim() || update.isPending}
            onClick={() =>
              setConfirmAction({ type: "assign", userId: assignee.trim() })
            }
          >
            <UserRoundCheck aria-hidden="true" size={17} /> Phân công
          </button>

          {!value.assignedTo || value.status !== "IN_REVIEW" ? (
            <button
              className="app-button app-button--primary"
              disabled={update.isPending || terminal}
              onClick={() => setConfirmAction({ type: "claim" })}
            >
              Nhận xử lý
            </button>
          ) : null}

          {value.status === "IN_REVIEW" ? (
            <>
              <label className="dike-field">
                <span>Kết luận</span>
                <select
                  aria-label="Kết luận báo cáo"
                  value={resolutionCode}
                  onChange={(event) => setResolutionCode(event.target.value)}
                >
                  <option value="POLICY_VIOLATION">
                    Có vi phạm chính sách
                  </option>
                  <option value="SAFETY_ACTION_TAKEN">
                    Đã áp dụng biện pháp an toàn
                  </option>
                  <option value="NO_VIOLATION">Không phát hiện vi phạm</option>
                  <option value="INSUFFICIENT_EVIDENCE">
                    Chưa đủ bằng chứng
                  </option>
                </select>
              </label>
              <label className="dike-field">
                <span>Ghi chú kết luận</span>
                <textarea
                  maxLength={1000}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Nêu rõ căn cứ cho quyết định"
                />
              </label>
              <button
                className="app-button app-button--primary"
                disabled={!note.trim() || update.isPending}
                onClick={() =>
                  setConfirmAction({
                    type: "transition",
                    status: "RESOLVED",
                    code: resolutionCode,
                    note: note.trim(),
                  })
                }
              >
                <CheckCircle2 aria-hidden="true" size={17} /> Giải quyết
              </button>
              <button
                className="app-button app-button--secondary"
                disabled={!note.trim() || update.isPending}
                onClick={() =>
                  setConfirmAction({
                    type: "transition",
                    status: "DISMISSED",
                    code:
                      resolutionCode === "POLICY_VIOLATION"
                        ? "NO_VIOLATION"
                        : resolutionCode,
                    note: note.trim(),
                  })
                }
              >
                Bác bỏ báo cáo
              </button>
            </>
          ) : null}

          {terminal ? (
            <button
              className="app-button app-button--secondary"
              disabled={update.isPending}
              onClick={() =>
                setConfirmAction({
                  type: "transition",
                  status: "IN_REVIEW",
                  code: "REOPENED",
                  note: "Mở lại để điều tra bổ sung",
                })
              }
            >
              Mở lại điều tra
            </button>
          ) : null}

          {value.targetType === "USER" ? (
            <div className="moderation-enforcement">
              <h3>An toàn tài khoản</h3>
              <label className="dike-field">
                <span>Lý do bắt buộc</span>
                <textarea
                  value={enforcementReason}
                  onChange={(event) => setEnforcementReason(event.target.value)}
                />
              </label>
              {targetIsSelf ? (
                <p className="auth-error" role="alert">
                  Bạn không thể khóa tài khoản của chính mình.
                </p>
              ) : null}
              <div className="journey-action-row">
                <button
                  className="app-button app-button--danger"
                  disabled={
                    targetIsSelf ||
                    !enforcementReason.trim() ||
                    update.isPending
                  }
                  onClick={() =>
                    setConfirmAction({
                      type: "enforce",
                      locked: true,
                      userId: value.targetId,
                      reason: enforcementReason.trim(),
                    })
                  }
                >
                  <LockKeyhole aria-hidden="true" size={16} /> Khóa
                </button>
                <button
                  className="app-button app-button--secondary"
                  disabled={!enforcementReason.trim() || update.isPending}
                  onClick={() =>
                    setConfirmAction({
                      type: "enforce",
                      locked: false,
                      userId: value.targetId,
                      reason: enforcementReason.trim(),
                    })
                  }
                >
                  <UnlockKeyhole aria-hidden="true" size={16} /> Mở khóa
                </button>
              </div>
            </div>
          ) : null}

          {update.isError && !conflict ? (
            <p className="auth-error" role="alert">
              {update.error.message}
            </p>
          ) : null}
          {update.isSuccess ? (
            <p className="success-message" role="status">
              Đã cập nhật báo cáo.
            </p>
          ) : null}
        </aside>
      </div>

      {confirmAction ? (
        <Confirmation
          action={confirmAction}
          pending={update.isPending}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => update.mutate(confirmAction)}
        />
      ) : null}
    </main>
  );
}

function Confirmation({
  action,
  pending,
  onCancel,
  onConfirm,
}: {
  action: ReportAction;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const destructive = action.type === "enforce" && action.locked;
  const title =
    action.type === "transition"
      ? "Xác nhận kết luận báo cáo"
      : action.type === "priority"
        ? "Xác nhận đổi mức ưu tiên"
        : action.type === "assign"
          ? "Xác nhận phân công"
          : action.type === "enforce"
            ? action.locked
              ? "Xác nhận khóa tài khoản"
              : "Xác nhận mở khóa"
            : "Xác nhận nhận xử lý";
  return (
    <div className="moderation-dialog-backdrop" role="presentation">
      <section
        className="settings-card moderation-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="moderation-confirm-title"
      >
        <ShieldAlert aria-hidden="true" size={28} />
        <h2 id="moderation-confirm-title">{title}</h2>
        <p>
          Hành động sẽ được ghi vào audit log và có thể làm thay đổi công việc
          của moderator khác.
        </p>
        <div className="journey-action-row">
          <button
            autoFocus
            className={
              destructive
                ? "app-button app-button--danger"
                : "app-button app-button--primary"
            }
            disabled={pending}
            onClick={onConfirm}
          >
            Xác nhận
          </button>
          <button
            className="app-button app-button--secondary"
            disabled={pending}
            onClick={onCancel}
          >
            Hủy
          </button>
        </div>
      </section>
    </div>
  );
}

function AuditTimeline({
  events,
  pending,
  error,
}: {
  events: AuditLogView[];
  pending: boolean;
  error: boolean;
}) {
  return (
    <section className="settings-card moderation-audit-card">
      <div className="section-heading">
        <div>
          <p className="app-eyebrow">Không thể chỉnh sửa</p>
          <h2>Lịch sử xử lý</h2>
        </div>
        <History aria-hidden="true" size={21} />
      </div>
      {pending ? (
        <p role="status">Đang tải audit log…</p>
      ) : error ? (
        <p className="journey-empty-copy">
          Bạn không có quyền xem audit log hoặc dữ liệu tạm thời không khả dụng.
        </p>
      ) : events.length === 0 ? (
        <p className="journey-empty-copy">
          Chưa có sự kiện audit cho báo cáo này.
        </p>
      ) : (
        <ol className="moderation-timeline">
          {events.map((event) => (
            <li key={event.id}>
              <span>
                <Clock3 aria-hidden="true" size={15} />
              </span>
              <div>
                <strong>
                  {actionLabels[event.action] ?? humanize(event.action)}
                </strong>
                <p>
                  {event.actorUserId} · {event.actorRole}
                </p>
                <small>{dateTime(event.occurredAt)}</small>
                {Object.keys(event.safeAfter ?? {}).length ? (
                  <p className="moderation-change">
                    {Object.entries(event.safeAfter)
                      .map(([key, value]) => `${humanize(key)}: ${value}`)
                      .join(" · ")}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Fact({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {href ? (
          <Link href={href}>
            {value} <ExternalLink aria-hidden="true" size={13} />
          </Link>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
function InfoBlock({
  title,
  body,
  success = false,
}: {
  title: string;
  body: string;
  success?: boolean;
}) {
  return (
    <div
      className={`moderation-note${success ? " moderation-note--success" : ""}`}
    >
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}
function targetLink(report: ReportView) {
  if (report.targetType === "USER")
    return `/users/${encodeURIComponent(report.targetId)}`;
  if (report.targetType === "BOOKING")
    return `/bookings/${encodeURIComponent(report.targetId)}`;
  if (report.targetType === "POST")
    return `/feed/${encodeURIComponent(report.targetId)}`;
  return undefined;
}
function targetTypeLabel(type: string) {
  return (
    (
      {
        USER: "Người dùng",
        BOOKING: "Booking",
        POST: "Bài đăng",
        MESSAGE: "Tin nhắn",
      } as Record<string, string>
    )[type] ?? type
  );
}
function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .toLocaleLowerCase("vi")
    .replace(/^./, (letter) => letter.toLocaleUpperCase("vi"));
}
function dateTime(value: string) {
  return new Date(value).toLocaleString("vi-VN");
}
