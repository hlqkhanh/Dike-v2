"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { journeyApi } from "../../src/journey/api";

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
    <main className="settings-page">
      <h1>Kiểm duyệt</h1>
      <section className="settings-card">
        <h2>Khoá/mở tài khoản</h2>
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
        <div className="social-tabs">
          <button
            disabled={!userId || !reason || command.isPending}
            onClick={() =>
              command.mutate(() => journeyApi.lockUser(userId, true, reason))
            }
          >
            Khoá
          </button>
          <button
            disabled={!userId || !reason || command.isPending}
            onClick={() =>
              command.mutate(() => journeyApi.lockUser(userId, false, reason))
            }
          >
            Mở khoá
          </button>
        </div>
      </section>
      {reports.isPending ? (
        <p>Đang tải…</p>
      ) : reports.isError ? (
        <p role="alert">{reports.error.message}</p>
      ) : (
        reports.data.map((report) => (
          <article className="settings-card" key={report.id}>
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
