"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { routingApi } from "../routing/client";
import { rideApi } from "./api";
import { RideNav, useRideCommand } from "./dashboard";
import { useAuthFailure } from "../auth/use-auth-failure";

export function NewPost({ routeId }: { routeId: string }) {
  const router = useRouter();
  const [departure, setDeparture] = useState("");
  const [arrival, setArrival] = useState("");
  const [visibility, setVisibility] = useState("FRIENDS");
  const [note, setNote] = useState("");
  const route = useQuery({
    queryKey: ["rides", "source-route", routeId],
    queryFn: () => routingApi.getRoute(routeId),
    enabled: Boolean(routeId),
    retry: false,
  });
  const command = useRideCommand();
  useAuthFailure(route.error);
  if (!routeId)
    return (
      <main className="settings-page">
        <h1>Đăng nhu cầu đi cùng</h1>
        <RideNav />
        <p>Chọn hai điểm và xem tuyến đường trước khi đăng.</p>
        <Link href="/map">Chọn tuyến trên bản đồ</Link>
      </main>
    );
  return (
    <main className="settings-page">
      <h1>Đăng nhu cầu đi cùng</h1>
      <RideNav />
      {route.isPending ? (
        <p>Đang kiểm tra tuyến đường…</p>
      ) : route.isError ? (
        <p role="alert">
          {route.error.message} <Link href="/map">Chọn lại tuyến</Link>
        </p>
      ) : (
        <form
          className="settings-card"
          onSubmit={(event) => {
            event.preventDefault();
            command.mutate({
              signature: `draft:${routeId}:${departure}:${arrival}:${visibility}:${note}`,
              run: async (key) => {
                const source = await rideApi.createSource(
                  {
                    routeId,
                    departureAt: new Date(departure).toISOString(),
                    arrivalAt: new Date(arrival).toISOString(),
                  },
                  key,
                );
                const draft = await rideApi.createPost(
                  {
                    type: "NEED_RIDE",
                    sourceId: source.id,
                    sourceVersion: source.version,
                    visibility,
                    note,
                  },
                  key,
                );
                router.push(`/feed/${encodeURIComponent(draft.id)}`);
                return draft;
              },
            });
          }}
        >
          <h2>
            {route.data.origin.publicAreaLabel} →{" "}
            {route.data.destination.publicAreaLabel}
          </h2>
          <p>
            Bài đăng chỉ hiển thị khu vực công khai. Kiểm tra bản nháp trước khi
            đăng.
          </p>
          <label>
            Có thể đi từ
            <input
              type="datetime-local"
              required
              value={departure}
              onChange={(event) => setDeparture(event.target.value)}
            />
          </label>
          <label>
            Cần đến trước
            <input
              type="datetime-local"
              required
              value={arrival}
              onChange={(event) => setArrival(event.target.value)}
            />
          </label>
          <label>
            Ai được xem
            <select
              value={visibility}
              onChange={(event) => setVisibility(event.target.value)}
            >
              <option value="FRIENDS">Bạn bè</option>
              <option value="PUBLIC">Thành viên Dike</option>
            </select>
          </label>
          <label>
            Ghi chú
            <textarea
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <button disabled={command.isPending}>Lưu bản nháp để kiểm tra</button>
        </form>
      )}
      {command.isError ? <p role="alert">{command.error.message}</p> : null}
    </main>
  );
}
