"use client";

import { Button } from "@dike/web-ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";

import { scheduleApi } from "../../../src/schedules/api";

export default function TravelIntentDetailPage() {
  const id = String(useParams<{ id: string }>().id);
  const client = useQueryClient();
  const intent = useQuery({
    queryKey: ["travel-intents", id],
    queryFn: () => scheduleApi.intent(id),
  });
  const match = useMutation({
    mutationFn: () => scheduleApi.matchIntent(id),
    onSuccess: (updated) =>
      client.setQueryData(["travel-intents", id], updated),
  });
  if (intent.isPending)
    return (
      <main className="settings-page">
        <p role="status">Đang tải nhu cầu…</p>
      </main>
    );
  if (intent.isError || !intent.data)
    return (
      <main className="settings-page">
        <p role="alert">Không tìm thấy nhu cầu.</p>
      </main>
    );
  const item = intent.data;
  return (
    <main className="settings-page">
      <p className="eyebrow">{item.commitmentState}</p>
      <h1>
        {item.origin.displayLabel} → {item.destination.displayLabel}
      </h1>
      <section className="settings-card">
        <p>
          {item.localDate} · {item.direction} · {item.travelRole}
        </p>
        <p>
          {item.earliestDepartureAt
            ? new Date(item.earliestDepartureAt).toLocaleString("vi-VN")
            : "Chưa chọn giờ sớm nhất"}
        </p>
        <Button disabled={match.isPending} onClick={() => match.mutate()}>
          Yêu cầu ghép chuyến
        </Button>{" "}
        <Link href={`/feed/new?intent=${encodeURIComponent(item.id)}`}>
          Tạo bài đăng
        </Link>
        {match.isError ? <p role="alert">{match.error.message}</p> : null}
      </section>
    </main>
  );
}
