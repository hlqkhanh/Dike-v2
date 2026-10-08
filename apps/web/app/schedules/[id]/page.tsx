"use client";

import { Button } from "@dike/web-ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";

import { scheduleApi } from "../../../src/schedules/api";

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
  if (schedule.isPending)
    return (
      <main className="settings-page">
        <p role="status">Đang tải lịch…</p>
      </main>
    );
  if (schedule.isError || !schedule.data)
    return (
      <main className="settings-page">
        <p role="alert">Không tìm thấy lịch trình.</p>
      </main>
    );
  const item = schedule.data;
  return (
    <main className="settings-page">
      <p className="eyebrow">{item.status}</p>
      <h1>{item.name}</h1>
      <section className="settings-card">
        <p>
          {item.usualOrigin.displayLabel} → {item.activityPlace.displayLabel}
        </p>
        <p>
          {item.weekdays.join(", ")} · {item.startLocalTime}–{item.endLocalTime}
        </p>
        <p>
          Vai trò: {item.defaultTravelRole} · Hiển thị: {item.visibility}
        </p>
        {item.warnings.length ? (
          <p role="alert">
            Lịch này đang xung đột với {item.warnings.length} lịch khác.
          </p>
        ) : null}
        <div className="social-tabs">
          {item.status === "ACTIVE" ? (
            <Button variant="secondary" onClick={() => change.mutate("pause")}>
              Tạm dừng
            </Button>
          ) : null}
          {item.status === "PAUSED" ? (
            <Button onClick={() => change.mutate("resume")}>Tiếp tục</Button>
          ) : null}
          {item.status !== "ENDED" ? (
            <Button variant="secondary" onClick={() => change.mutate("end")}>
              Kết thúc lịch
            </Button>
          ) : null}
        </div>
        {change.isError ? <p role="alert">{change.error.message}</p> : null}
      </section>
    </main>
  );
}
