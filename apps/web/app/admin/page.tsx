"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronRight,
  Clock3,
  LockKeyhole,
  Search,
  ShieldAlert,
  Siren,
  UnlockKeyhole,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { journeyApi } from "../../src/journey/api";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "../components/app-ui";

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

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <main className="settings-page">
          <LoadingState label="Đang tải hàng đợi kiểm duyệt" />
        </main>
      }
    >
      <AdminContent />
    </Suspense>
  );
}

function AdminContent() {
  const client = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [status, setStatus] = useState(() => params.get("status") ?? "");
  const [priority, setPriority] = useState(() => params.get("priority") ?? "");
  const [search, setSearch] = useState(() => params.get("q") ?? "");
  const [targetType, setTargetType] = useState(
    () => params.get("target") ?? "",
  );
  const [sort, setSort] = useState(() => params.get("sort") ?? "priority");
  const [userId, setUserId] = useState("");
  const [reason, setReason] = useState("");
  const [pendingLock, setPendingLock] = useState<boolean | null>(null);
  const reports = useQuery({
    queryKey: ["admin", "reports", status, priority],
    queryFn: () =>
      journeyApi.adminReports(status || undefined, priority || undefined),
    retry: false,
  });
  const command = useMutation({
    mutationFn: ({ locked }: { locked: boolean }) =>
      journeyApi.lockUser(userId.trim(), locked, reason.trim()),
    onSuccess: async () => {
      setReason("");
      setPendingLock(null);
      await client.invalidateQueries({ queryKey: ["admin"] });
    },
  });
  useEffect(() => {
    const next = new URLSearchParams();
    if (status) next.set("status", status);
    if (priority) next.set("priority", priority);
    if (targetType) next.set("target", targetType);
    if (search.trim()) next.set("q", search.trim());
    if (sort !== "priority") next.set("sort", sort);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }, [pathname, priority, router, search, sort, status, targetType]);
  const visible = useMemo(
    () =>
      [...(reports.data ?? [])]
        .filter(
          (item) =>
            (!targetType || item.targetType === targetType) &&
            (!search.trim() ||
              `${item.id} ${item.targetId} ${item.reporterId} ${item.contextBookingId ?? ""}`
                .toLowerCase()
                .includes(search.trim().toLowerCase())),
        )
        .sort((left, right) =>
          sort === "newest"
            ? Date.parse(right.createdAt) - Date.parse(left.createdAt)
            : left.priority.localeCompare(right.priority) ||
              Date.parse(left.createdAt) - Date.parse(right.createdAt),
        ),
    [reports.data, search, sort, targetType],
  );
  const pending = reports.data?.filter(
    (item) => !["RESOLVED", "DISMISSED"].includes(item.status),
  ).length;
  return (
    <main className="settings-page admin-page">
      <PageHeader
        eyebrow="Khu vực quản trị"
        title="Kiểm duyệt cộng đồng"
        description="Ưu tiên báo cáo, ghi nhận quyết định và bảo vệ trải nghiệm an toàn cho thành viên."
      />
      <section className="admin-stats" aria-label="Tổng quan kiểm duyệt">
        <Stat icon={ShieldAlert} value={pending} label="Cần xử lý" />
        <Stat
          icon={Clock3}
          value={
            reports.data?.filter((item) => item.status === "IN_REVIEW").length
          }
          label="Đang điều tra"
        />
        <Stat
          icon={CheckCircle2}
          value={
            reports.data?.filter((item) => item.status === "RESOLVED").length
          }
          label="Đã giải quyết"
        />
        <Stat
          icon={Siren}
          value={
            reports.data?.filter((item) => ["P0", "P1"].includes(item.priority))
              .length
          }
          label="Ưu tiên cao"
        />
      </section>
      <section
        className="settings-card moderation-toolbar"
        aria-label="Bộ lọc báo cáo"
      >
        <label>
          <span className="sr-only">Tìm báo cáo</span>
          <Search aria-hidden="true" size={17} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm report ID, target ID…"
          />
        </label>
        <select
          aria-label="Lọc trạng thái"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">Mọi trạng thái</option>
          {Object.entries(statusLabels).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Lọc loại đối tượng"
          value={targetType}
          onChange={(event) => setTargetType(event.target.value)}
        >
          <option value="">Mọi đối tượng</option>
          {[
            ["USER", "Người dùng"],
            ["BOOKING", "Booking"],
            ["POST", "Bài đăng"],
            ["MESSAGE", "Tin nhắn"],
          ].map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Sắp xếp báo cáo"
          value={sort}
          onChange={(event) => setSort(event.target.value)}
        >
          <option value="priority">Ưu tiên cao trước</option>
          <option value="newest">Mới nhất trước</option>
        </select>
        <select
          aria-label="Lọc độ ưu tiên"
          value={priority}
          onChange={(event) => setPriority(event.target.value)}
        >
          <option value="">Mọi ưu tiên</option>
          {["P0", "P1", "P2", "P3"].map((value) => (
            <option value={value} key={value}>
              {value}
            </option>
          ))}
        </select>
      </section>
      {reports.isPending ? (
        <LoadingState />
      ) : reports.isError ? (
        <ErrorState
          message={reports.error.message}
          onRetry={() => void reports.refetch()}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Không có báo cáo phù hợp"
          description="Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm."
        />
      ) : (
        <div className="moderation-list">
          {visible.map((report) => (
            <Link
              className="settings-card moderation-card"
              href={`/admin/reports/${report.id}`}
              key={report.id}
            >
              <span
                className={`moderation-priority moderation-priority--${report.priority.toLowerCase()}`}
              >
                {report.priority}
              </span>
              <div>
                <p className="app-eyebrow">
                  {statusLabels[report.status] ?? report.status}
                </p>
                <h2>{reasonLabels[report.reason] ?? report.reason}</h2>
                <p>
                  {targetLabel(report.targetType)} · {report.targetId}
                </p>
                <small>
                  {new Date(report.createdAt).toLocaleString("vi-VN")} ·{" "}
                  {report.assignedTo
                    ? `Đang xử lý bởi ${report.assignedTo}`
                    : "Chưa phân công"}
                </small>
              </div>
              <ChevronRight aria-hidden="true" size={20} />
            </Link>
          ))}
        </div>
      )}
      <section className="settings-card admin-account-card">
        <div className="section-heading">
          <div>
            <p className="app-eyebrow">Chỉ dành cho admin</p>
            <h2>Khóa hoặc mở tài khoản</h2>
            <p>
              Không thể tự khóa chính mình. Mọi hành động đều được ghi audit.
            </p>
          </div>
        </div>
        <div className="admin-form-grid">
          <label>
            User ID
            <input
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
            />
          </label>
          <label>
            Lý do
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
        </div>
        <div className="social-tabs">
          <button
            className="app-button app-button--danger"
            disabled={!userId.trim() || !reason.trim() || command.isPending}
            onClick={() => setPendingLock(true)}
          >
            <LockKeyhole aria-hidden="true" size={17} /> Khóa tài khoản
          </button>
          <button
            className="app-button app-button--secondary"
            disabled={!userId.trim() || !reason.trim() || command.isPending}
            onClick={() => setPendingLock(false)}
          >
            <UnlockKeyhole aria-hidden="true" size={17} /> Mở khóa
          </button>
        </div>
        {pendingLock !== null ? (
          <div
            className="admin-confirmation"
            role="alertdialog"
            aria-labelledby="account-confirmation-title"
          >
            <div>
              <strong id="account-confirmation-title">
                {pendingLock
                  ? "Xác nhận khóa tài khoản"
                  : "Xác nhận mở khóa tài khoản"}
              </strong>
              <p>
                {pendingLock
                  ? `Người dùng ${userId} sẽ mất quyền truy cập ngay lập tức.`
                  : `Người dùng ${userId} sẽ có thể truy cập lại hệ thống.`}
              </p>
            </div>
            <div className="journey-action-row">
              <button
                className={
                  pendingLock
                    ? "app-button app-button--danger"
                    : "app-button app-button--primary"
                }
                disabled={command.isPending}
                onClick={() => command.mutate({ locked: pendingLock })}
              >
                Xác nhận
              </button>
              <button
                className="app-button app-button--secondary"
                disabled={command.isPending}
                onClick={() => setPendingLock(null)}
              >
                Hủy
              </button>
            </div>
          </div>
        ) : null}
        {command.isSuccess ? (
          <p className="success-message" role="status">
            Đã cập nhật trạng thái tài khoản.
          </p>
        ) : null}
        {command.isError ? (
          <p className="auth-error" role="alert">
            Không thể cập nhật. Kiểm tra quyền admin và trạng thái tài khoản.
          </p>
        ) : null}
      </section>
    </main>
  );
}

function targetLabel(type: string) {
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

function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof ShieldAlert;
  value?: number;
  label: string;
}) {
  return (
    <div>
      <span>
        <Icon aria-hidden="true" size={19} />
      </span>
      <p>
        <strong>{value ?? "—"}</strong>
        <small>{label}</small>
      </p>
    </div>
  );
}
