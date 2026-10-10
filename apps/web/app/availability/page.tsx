"use client";

import Link from "next/link";
import { ApiError } from "@dike/api-client-ts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { Clock3, Compass, LocateFixed, Power, Route } from "lucide-react";
import { journeyApi } from "../../src/journey/api";
import { rideApi } from "../../src/rides/api";
import { dateTime } from "../../src/rides/dashboard";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "../components/app-ui";

type LocationState = "IDLE" | "REQUESTING" | "READY" | "DENIED" | "UNSUPPORTED";
export default function AvailabilityPage() {
  const client = useQueryClient();
  const [tripId, setTripId] = useState("");
  const [locationState, setLocationState] = useState<LocationState>("IDLE");
  const current = useQuery({
    queryKey: ["availability"],
    queryFn: journeyApi.availability,
    retry: false,
  });
  const trips = useQuery({
    queryKey: ["rides", "trips", "availability"],
    queryFn: () => rideApi.trips(),
  });
  const openTrips = (trips.data?.items ?? []).filter((trip) =>
    ["OPEN", "FULL"].includes(trip.status),
  );
  const inactive =
    current.error instanceof ApiError && current.error.status === 404;
  const refresh = useCallback(
    () => client.invalidateQueries({ queryKey: ["availability"] }),
    [client],
  );
  const command = useMutation({
    mutationFn: (run: () => Promise<unknown>) => run(),
    onSuccess: refresh,
  });
  const heartbeat = command.mutate;
  useEffect(() => {
    if (!current.data) return;
    const timer = window.setInterval(
      () => heartbeat(journeyApi.heartbeat),
      15000,
    );
    return () => window.clearInterval(timer);
  }, [current.data, heartbeat]);
  function enable() {
    if (!("geolocation" in navigator)) {
      setLocationState("UNSUPPORTED");
      command.mutate(() => journeyApi.enableAvailability(tripId));
      return;
    }
    setLocationState("REQUESTING");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationState("READY");
        command.mutate(() =>
          journeyApi.enableAvailability(
            tripId,
            position.coords.latitude,
            position.coords.longitude,
            position.coords.accuracy,
          ),
        );
      },
      () => {
        setLocationState("DENIED");
        command.mutate(() => journeyApi.enableAvailability(tripId));
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }
  return (
    <main className="settings-page availability-page">
      <PageHeader
        eyebrow="Khám phá chuyến"
        title="Sẵn sàng đi ngay"
        description="Chọn một chuyến đang mở để hành khách phù hợp có thể tìm thấy bạn trong thời gian giới hạn."
      />
      {current.isPending || trips.isPending ? (
        <LoadingState label="Đang kiểm tra trạng thái sẵn sàng" />
      ) : current.isError && !inactive && !current.data ? (
        <ErrorState
          message={current.error.message}
          onRetry={() => void current.refetch()}
        />
      ) : current.data ? (
        <section className="settings-card availability-active-card">
          <span className="availability-pulse" aria-hidden="true" />
          <div>
            <p className="app-eyebrow">Đang phát tín hiệu</p>
            <h2>Bạn đang sẵn sàng đi ngay</h2>
            <p>
              <Route aria-hidden="true" size={17} /> Chuyến{" "}
              {current.data.tripId}
            </p>
            <p>
              <Clock3 aria-hidden="true" size={17} /> Cập nhật lúc{" "}
              {new Date(current.data.lastHeartbeatAt).toLocaleTimeString(
                "vi-VN",
              )}
            </p>
            <small>
              Tự động hết hạn lúc{" "}
              {new Date(current.data.expiresAt).toLocaleString("vi-VN")}
            </small>
          </div>
          <button
            className="app-button app-button--danger"
            disabled={command.isPending}
            onClick={() => {
              if (window.confirm("Tắt trạng thái sẵn sàng đi ngay?"))
                command.mutate(journeyApi.disableAvailability);
            }}
          >
            <Power aria-hidden="true" size={17} /> Tắt sẵn sàng
          </button>
        </section>
      ) : openTrips.length === 0 ? (
        <EmptyState
          icon={Compass}
          title="Không có chuyến đang mở"
          description="Mở một chuyến trước khi bật trạng thái sẵn sàng đi ngay."
          action={
            <Link className="app-button app-button--primary" href="/trips/new">
              Tạo chuyến mới
            </Link>
          }
        />
      ) : (
        <section className="settings-card availability-setup-card">
          <div>
            <p className="app-eyebrow">Bước 1</p>
            <h2>Chọn chuyến đang mở</h2>
          </div>
          <div className="availability-trip-list">
            {openTrips.map((trip) => (
              <label
                className={tripId === trip.id ? "is-selected" : ""}
                key={trip.id}
              >
                <input
                  type="radio"
                  name="trip"
                  value={trip.id}
                  checked={tripId === trip.id}
                  onChange={() => setTripId(trip.id)}
                />
                <span>
                  <strong>
                    {trip.originLabel} → {trip.destinationLabel}
                  </strong>
                  <small>
                    {dateTime(trip.departureAt)} · còn {trip.remainingSeats} chỗ
                  </small>
                </span>
              </label>
            ))}
          </div>
          <div className="availability-location">
            <LocateFixed aria-hidden="true" size={22} />
            <div>
              <strong>Vị trí gần đúng</strong>
              <p>{locationMessage(locationState)}</p>
            </div>
          </div>
          <button
            className="app-button app-button--primary"
            disabled={
              !tripId || command.isPending || locationState === "REQUESTING"
            }
            onClick={enable}
          >
            {locationState === "REQUESTING"
              ? "Đang lấy vị trí…"
              : "Bật sẵn sàng"}
          </button>
        </section>
      )}
      {command.isError ? (
        <p className="auth-error" role="alert">
          {command.error.message}
        </p>
      ) : null}
    </main>
  );
}
function locationMessage(state: LocationState) {
  return {
    IDLE: "Diké sẽ hỏi quyền vị trí khi bạn bật trạng thái.",
    REQUESTING: "Đang chờ trình duyệt cấp quyền vị trí.",
    READY: "Đã nhận vị trí từ thiết bị.",
    DENIED: "Bạn đã từ chối vị trí; hệ thống chỉ dùng thông tin chuyến.",
    UNSUPPORTED:
      "Thiết bị không hỗ trợ vị trí; hệ thống chỉ dùng thông tin chuyến.",
  }[state];
}
