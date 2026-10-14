"use client";

import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { ApiError } from "@dike/api-client-ts";
import { rideApi } from "./api";
import { useAuthFailure } from "../auth/use-auth-failure";

const RouteMap = dynamic(() => import("./post-route-map"), {
  ssr: false,
  loading: () => <div className="post-route-placeholder">Đang mở bản đồ…</div>,
});

export function PostRoute({
  id,
  origin,
  destination,
}: {
  id: string;
  origin: string;
  destination: string;
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
  return (
    <div className="post-route-preview">
      {route.isPending ? (
        <div className="post-route-placeholder" role="status">
          Đang chuẩn bị tuyến đường…
        </div>
      ) : route.isError || !route.data || route.data.geometry.length < 2 ? (
        <div className="post-route-placeholder" role="status">
          <span>
            {route.error instanceof ApiError && route.error.status !== 404
              ? "Chưa tải được tuyến đường. Vui lòng thử lại."
              : "Bài đăng này chưa có tuyến đường được lưu."}
          </span>
          <button type="button" onClick={() => void route.refetch()}>
            Thử lại
          </button>
        </div>
      ) : (
        <>
          <RouteMap
            route={route.data}
            origin={origin}
            destination={destination}
          />
          <div className="post-route-metrics">
            <strong>
              {new Intl.NumberFormat("vi-VN", {
                maximumFractionDigits: 1,
              }).format(route.data.distanceMeters / 1000)}{" "}
              km
            </strong>
            <span>
              Khoảng {Math.max(1, Math.round(route.data.durationSeconds / 60))}{" "}
              phút
            </span>
          </div>
          {route.data.provider === "FAKE" && (
            <p className="post-route-demo">Tuyến minh họa của bài đăng mẫu.</p>
          )}
        </>
      )}
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
    </div>
  );
}
