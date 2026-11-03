"use client";

import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { Clock3, Flag, MapPin } from "lucide-react";
import { ApiError, type PickupCheck } from "@dike/api-client-ts";
import { rideApi } from "./api";
import { useAuthFailure } from "../auth/use-auth-failure";
import { sharedEndpointStops } from "./post-route-data";

const RouteMap = dynamic(() => import("./post-route-map"), {
  ssr: false,
  loading: () => <div className="post-route-placeholder">Đang mở bản đồ…</div>,
});

export function PostRoute({
  id,
  origin,
  destination,
  pickupCheck,
  sharedEndpoints = false,
  driver,
  passenger,
}: {
  id: string;
  origin: string;
  destination: string;
  pickupCheck?: PickupCheck;
  sharedEndpoints?: boolean;
  driver?: { name: string; avatarUrl?: string | null };
  passenger?: { name: string; avatarUrl?: string | null };
}) {
  const route = useQuery({
    queryKey: ["feed", "route", id],
    queryFn: () => rideApi.postRoute(id),
    staleTime: 5 * 60_000,
    retry: (count, error) =>
      error instanceof ApiError &&
      error.code === "POST_ROUTE_CALCULATING" &&
      count < 5,
    retryDelay: 3000,
  });
  useAuthFailure(route.error);
  const selectedRoute =
    pickupCheck && pickupCheck.geometry.length >= 2
      ? {
          geometry: pickupCheck.geometry,
          distanceMeters: 0,
          durationSeconds: 0,
          provider: pickupCheck.provider,
        }
      : undefined;
  const displayedRoute = selectedRoute ?? route.data;
  const isLoading = !selectedRoute && route.isPending;
  const hasRoute = Boolean(
    displayedRoute && displayedRoute.geometry.length >= 2,
  );
  const sharedStops = sharedEndpoints
    ? sharedEndpointStops(displayedRoute?.geometry ?? [], origin, destination)
    : undefined;
  const stops = selectedRoute ? pickupCheck : sharedStops;
  return (
    <div className="post-route-preview">
      {isLoading ? (
        <div className="post-route-placeholder" role="status">
          Đang chuẩn bị tuyến đường…
        </div>
      ) : !hasRoute ? (
        <div className="post-route-placeholder" role="status">
          <span>
            {!pickupCheck &&
            route.error instanceof ApiError &&
            route.error.status !== 404
              ? "Chưa tải được tuyến đường. Vui lòng thử lại."
              : pickupCheck
                ? "Yêu cầu này chưa có tuyến đường được lưu."
                : "Bài đăng này chưa có tuyến đường được lưu."}
          </span>
          {!selectedRoute ? (
            <button type="button" onClick={() => void route.refetch()}>
              Thử lại
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <RouteMap
            route={displayedRoute!}
            origin={origin}
            destination={destination}
            pickup={stops?.pickup}
            pickupIndex={stops?.pickupIndex}
            dropoff={stops?.dropoff}
            dropoffIndex={stops?.dropoffIndex}
            driver={driver}
            passenger={passenger}
          />
          {!pickupCheck ? (
            <div className="post-route-metrics">
              <strong>
                {new Intl.NumberFormat("vi-VN", {
                  maximumFractionDigits: 1,
                }).format(displayedRoute!.distanceMeters / 1000)}{" "}
                km
              </strong>
              <span>
                Khoảng{" "}
                {Math.max(1, Math.round(displayedRoute!.durationSeconds / 60))}{" "}
                phút
              </span>
            </div>
          ) : null}
          {!pickupCheck && displayedRoute!.provider === "FAKE" && (
            <p className="post-route-demo">Tuyến minh họa của bài đăng mẫu.</p>
          )}
        </>
      )}
      {sharedEndpoints ? (
        <div className="post-route-shared-members" role="status">
          <strong>
            {driver?.name || "Người chở"} và{" "}
            {passenger?.name || "Người đi cùng"}
          </strong>
          <span>Đi chung toàn tuyến · Chung điểm đón và điểm đến</span>
        </div>
      ) : null}
      {pickupCheck && !selectedRoute && hasRoute ? (
        <p className="post-route-demo" role="status">
          Yêu cầu chưa lưu tuyến ghép. Bản đồ đang hiển thị tuyến của bài đăng.
        </p>
      ) : null}
      {pickupCheck ? (
        <div className="post-route-selected-details" aria-live="polite">
          <p>
            <MapPin size={18} aria-hidden="true" />
            <span>
              <small>Điểm đi của người chở</small>
              <strong>{origin}</strong>
            </span>
          </p>
          <p>
            <MapPin size={18} aria-hidden="true" />
            <span>
              <small>Điểm đón người đi cùng</small>
              <strong>{pickupCheck.pickup.displayLabel}</strong>
            </span>
          </p>
          <p>
            <Flag size={18} aria-hidden="true" />
            <span>
              <small>Điểm trả người đi cùng</small>
              <strong>
                {pickupCheck.dropoff?.displayLabel ??
                  pickupCheck.destinationLabel}
              </strong>
            </span>
          </p>
          <p>
            <Flag size={18} aria-hidden="true" />
            <span>
              <small>Điểm đến của người chở</small>
              <strong>{destination}</strong>
            </span>
          </p>
          <p>
            <Clock3 size={18} aria-hidden="true" />
            <span>
              <small>Dự kiến đón</small>
              <strong>{formatPickupTime(pickupCheck.pickupAt)}</strong>
            </span>
          </p>
        </div>
      ) : (
        <div className="post-route-places">
          <p>
            <MapPin size={16} aria-hidden="true" />
            <span>{origin}</span>
          </p>
          <p>
            <MapPin size={16} aria-hidden="true" />
            <span>{destination}</span>
          </p>
        </div>
      )}
      {stops ? (
        <div className="post-route-legend" aria-label="Chú thích tuyến đường">
          {stops.pickupIndex > 0 ? (
            <span>
              <i className="is-pickup" />
              Người chở đến đón
            </span>
          ) : null}
          <span>
            <i className="is-shared" />
            Đoạn đi chung
          </span>
          {stops.dropoffIndex != null &&
          stops.dropoffIndex < (displayedRoute?.geometry.length ?? 0) - 1 ? (
            <span>
              <i className="is-driver" />
              Người chở đi tiếp
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function formatPickupTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}
