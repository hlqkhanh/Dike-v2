"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { journeyApi } from "../../src/journey/api";

export default function NotificationsPage() {
  const client = useQueryClient();
  const list = useQuery({
    queryKey: ["notifications"],
    queryFn: journeyApi.notifications,
    refetchInterval: 15000,
  });
  const readAll = useMutation({
    mutationFn: journeyApi.readAllNotifications,
    onSuccess: async () =>
      client.invalidateQueries({ queryKey: ["notifications"] }),
  });
  return (
    <main className="settings-page">
      <h1>Thông báo</h1>
      <button onClick={() => readAll.mutate()} disabled={readAll.isPending}>
        Đánh dấu tất cả đã đọc
      </button>
      {list.isPending ? (
        <p>Đang tải…</p>
      ) : list.isError ? (
        <p role="alert">{list.error.message}</p>
      ) : (
        list.data.map((item) => (
          <article className="settings-card" key={item.id}>
            <h2>{item.title}</h2>
            <p>{item.body}</p>
            <small>
              {new Date(item.createdAt).toLocaleString("vi-VN")} ·{" "}
              {item.readAt ? "Đã đọc" : "Chưa đọc"}
            </small>
          </article>
        ))
      )}
    </main>
  );
}
