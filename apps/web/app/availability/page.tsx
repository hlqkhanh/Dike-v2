"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { journeyApi } from "../../src/journey/api";

export default function AvailabilityPage() {
  const client = useQueryClient();
  const [tripId, setTripId] = useState("");
  const current = useQuery({
    queryKey: ["availability"],
    queryFn: journeyApi.availability,
    retry: false,
  });
  const refresh = async () =>
    client.invalidateQueries({ queryKey: ["availability"] });
  const command = useMutation({
    mutationFn: (run: () => Promise<unknown>) => run(),
    onSuccess: refresh,
  });
  const heartbeat = command.mutate;
  useEffect(() => {
    if (!current.data) return;
    const timer = setInterval(() => heartbeat(journeyApi.heartbeat), 15000);
    return () => clearInterval(timer);
  }, [current.data, heartbeat]);
  const enable = () =>
    navigator.geolocation.getCurrentPosition(
      (position) =>
        command.mutate(() =>
          journeyApi.enableAvailability(
            tripId,
            position.coords.latitude,
            position.coords.longitude,
            position.coords.accuracy,
          ),
        ),
      () => command.mutate(() => journeyApi.enableAvailability(tripId)),
    );
  return (
    <main className="settings-page">
      <h1>Sẵn sàng đi ngay</h1>
      <section className="settings-card">
        {current.data ? (
          <>
            <h2>Đang sẵn sàng</h2>
            <p>
              Trip {current.data.tripId} · heartbeat{" "}
              {new Date(current.data.lastHeartbeatAt).toLocaleTimeString(
                "vi-VN",
              )}
            </p>
            <button
              onClick={() => command.mutate(journeyApi.disableAvailability)}
            >
              Tắt sẵn sàng
            </button>
          </>
        ) : (
          <>
            <label>
              Trip đang mở
              <input
                value={tripId}
                onChange={(event) => setTripId(event.target.value)}
              />
            </label>
            <button
              disabled={!tripId.trim() || command.isPending}
              onClick={enable}
            >
              Bật sẵn sàng
            </button>
          </>
        )}
        {command.isError ? <p role="alert">{command.error.message}</p> : null}
      </section>
    </main>
  );
}
