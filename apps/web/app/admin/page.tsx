"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  CheckCircle2,
  LockKeyhole,
  ShieldAlert,
  UnlockKeyhole,
} from "lucide-react";
import { journeyApi } from "../../src/journey/api";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "../components/app-ui";

export default function AdminPage() {
  const client = useQueryClient();
  const reports = useQuery({
    queryKey: ["admin", "reports"],
    queryFn: journeyApi.adminReports,
    retry: false,
  });
  const [userId, setUserId] = useState("");
  const [reason, setReason] = useState("");
  const refresh = async () =>
    client.invalidateQueries({ queryKey: ["admin", "reports"] });
  const command = useMutation({
    mutationFn: (run: () => Promise<unknown>) => run(),
    onSuccess: refresh,
  });
  return (
    <main className="settings-page admin-page">
      <PageHeader
        eyebrow="Khu vực quản trị"
        title="Kiểm duyệt cộng đồng"
        description="Xử lý báo cáo và bảo vệ trải nghiệm an toàn cho mọi thành viên Diké."
      />
      <section className="admin-stats" aria-label="Tổng quan kiểm duyệt">
        <div>
          <span>
            <ShieldAlert aria-hidden="true" size={19} />
          </span>
          <p>
            <strong>{reports.data?.length ?? "—"}</strong>
            <small>Báo cáo cần xem</small>
          </p>
        </div>
        <div>
          <span>
            <CheckCircle2 aria-hidden="true" size={19} />
          </span>
          <p>
            <strong>
              {reports.data?.filter((item) => item.status === "RESOLVED")
                .length ?? "—"}
            </strong>
            <small>Đã giải quyết</small>
          </p>
        </div>
      </section>
      <section className="settings-card admin-account-card">
        <div className="section-heading">
          <div>
            <p className="app-eyebrow">Tác vụ nhanh</p>
            <h2>Khoá hoặc mở tài khoản</h2>
            <p>Hành động này được ghi lại trong nhật ký kiểm duyệt.</p>
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
            disabled={!userId || !reason || command.isPending}
            onClick={() =>
              command.mutate(() => journeyApi.lockUser(userId, true, reason))
            }
          >
            <LockKeyhole aria-hidden="true" size={17} /> Khoá tài khoản
          </button>
          <button
            className="app-button app-button--secondary"
            disabled={!userId || !reason || command.isPending}
            onClick={() =>
              command.mutate(() => journeyApi.lockUser(userId, false, reason))
            }
          >
            <UnlockKeyhole aria-hidden="true" size={17} /> Mở khoá
          </button>
        </div>
      </section>
      <div className="section-heading">
        <div>
          <p className="app-eyebrow">Hàng đợi</p>
          <h2>Báo cáo gần đây</h2>
        </div>
      </div>
      {reports.isPending ? (
        <LoadingState />
      ) : reports.isError ? (
        <ErrorState
          message={reports.error.message}
          onRetry={() => void reports.refetch()}
        />
      ) : reports.data.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Không có báo cáo chờ xử lý"
          description="Cộng đồng đang ổn. Báo cáo mới sẽ xuất hiện ở đây theo mức độ ưu tiên."
        />
      ) : (
        reports.data.map((report) => (
          <article className="settings-card moderation-card" key={report.id}>
            <span className="moderation-priority">{report.priority}</span>
            <h2>
              {report.targetType} · {report.reason}
            </h2>
            <p>
              {report.status} · {report.priority}
            </p>
            <p>Target: {report.targetId}</p>
            <div className="social-tabs">
              <button
                disabled={command.isPending}
                onClick={() =>
                  command.mutate(() =>
                    journeyApi.claimReport(report.id, report.version),
                  )
                }
              >
                Nhận xử lý
              </button>
              {report.status === "IN_REVIEW" ? (
                <button
                  disabled={command.isPending}
                  onClick={() =>
                    command.mutate(() =>
                      journeyApi.transitionReport(
                        report.id,
                        "RESOLVED",
                        "REVIEWED",
                        "Đã xem xét bằng dashboard",
                        report.version,
                      ),
                    )
                  }
                >
                  Hoàn tất
                </button>
              ) : null}
            </div>
          </article>
        ))
      )}
    </main>
  );
}
