"use client";

import { ApiError } from "@dike/api-client-ts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
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

export default function AdminReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const client = useQueryClient();
  const [note, setNote] = useState("");
  const report = useQuery({
    queryKey: ["admin", "reports", id],
    queryFn: () => journeyApi.adminReport(id),
    retry: false,
  });
  const update = useMutation({
    mutationFn: (action: "claim" | "resolve" | "dismiss") => {
      const current = report.data!;
      if (action === "claim")
        return journeyApi.claimReport(id, current.version);
      return journeyApi.transitionReport(
        id,
        action === "resolve" ? "RESOLVED" : "DISMISSED",
        action === "resolve" ? "REVIEWED" : "NO_VIOLATION",
        note,
        current.version,
      );
    },
    onSuccess: (value) => client.setQueryData(["admin", "reports", id], value),
  });
  if (report.isPending)
    return (
      <main className="settings-page">
        <LoadingState label="Đang tải báo cáo" />
      </main>
    );
  if (report.isError || !report.data)
    return (
      <main className="settings-page">
        <ErrorState
          message="Không thể tải báo cáo này."
          onRetry={() => void report.refetch()}
        />
      </main>
    );
  const value = report.data;
  const conflict =
    update.error instanceof ApiError && update.error.status === 409;
  return (
    <main className="settings-page admin-report-detail">
      <Link className="back-link" href="/admin">
        <ArrowLeft aria-hidden="true" size={17} /> Hàng đợi kiểm duyệt
      </Link>
      <PageHeader
        eyebrow={`Báo cáo ${value.id}`}
        title={reasonLabels[value.reason] ?? value.reason}
        description={`${value.targetType} · ${value.targetId}`}
      />
      <div className="moderation-detail-grid">
        <section className="settings-card">
          <div className="moderation-detail-heading">
            <ShieldAlert aria-hidden="true" />
            <div>
              <p>Trạng thái</p>
              <strong>{statusLabels[value.status] ?? value.status}</strong>
            </div>
            <span
              className={`moderation-priority moderation-priority--${value.priority.toLowerCase()}`}
            >
              {value.priority}
            </span>
          </div>
          <dl className="moderation-facts">
            <div>
              <dt>Người báo cáo</dt>
              <dd>{value.reporterId}</dd>
            </div>
            <div>
              <dt>Đối tượng</dt>
              <dd>{value.targetId}</dd>
            </div>
            <div>
              <dt>Người xử lý</dt>
              <dd>{value.assignedTo ?? "Chưa phân công"}</dd>
            </div>
            <div>
              <dt>Tạo lúc</dt>
              <dd>{new Date(value.createdAt).toLocaleString("vi-VN")}</dd>
            </div>
          </dl>
          {value.note ? (
            <div className="moderation-note">
              <strong>Mô tả từ người báo cáo</strong>
              <p>{value.note}</p>
            </div>
          ) : null}
          {value.resolutionNote ? (
            <div className="moderation-note moderation-note--success">
              <strong>Kết luận</strong>
              <p>{value.resolutionNote}</p>
            </div>
          ) : null}
        </section>
        <aside className="settings-card moderation-actions-card">
          <h2>Hành động xử lý</h2>
          {value.status !== "IN_REVIEW" ? (
            <button
              className="app-button"
              disabled={update.isPending}
              onClick={() => update.mutate("claim")}
            >
              Nhận xử lý
            </button>
          ) : (
            <>
              <label className="dike-field">
                <span>Ghi chú kết luận</span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Nêu rõ căn cứ cho quyết định"
                />
              </label>
              <button
                className="app-button"
                disabled={!note.trim() || update.isPending}
                onClick={() => update.mutate("resolve")}
              >
                <CheckCircle2 aria-hidden="true" size={17} /> Giải quyết
              </button>
              <button
                className="app-button app-button--secondary"
                disabled={!note.trim() || update.isPending}
                onClick={() => update.mutate("dismiss")}
              >
                Bác bỏ báo cáo
              </button>
            </>
          )}
          {conflict ? (
            <p className="auth-error" role="alert">
              Báo cáo đã thay đổi ở nơi khác. Hãy tải lại dữ liệu.
            </p>
          ) : update.isError ? (
            <p className="auth-error" role="alert">
              Không thể cập nhật báo cáo.
            </p>
          ) : null}
          {update.isSuccess ? (
            <p className="success-message" role="status">
              Đã cập nhật báo cáo.
            </p>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
