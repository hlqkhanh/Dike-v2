"use client";

import { ApiError } from "@dike/api-client-ts";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";

import { useAuthFailure } from "../auth/use-auth-failure";
import { rideApi } from "./api";

const RouteMap = dynamic(() => import("./post-route-map"), {
  ssr: false,
  loading: () => <div className="feed-route-map-state">Đang mở bản đồ…</div>,
});

export function FeedRoutePreview({
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
      count < 3,
    retryDelay: 2000,
  });
  useAuthFailure(route.error);

  return (
    <div className="feed-route-preview" aria-label="Bản đồ tuyến đường">
      {route.isPending ? (
        <div className="feed-route-map-state" role="status">
          Đang tải tuyến đường…
        </div>
      ) : route.isError || !route.data || route.data.geometry.length < 2 ? (
        <div className="feed-route-map-state is-empty" role="status">
          Chưa có bản đồ tuyến đường
        </div>
      ) : (
        <RouteMap
          route={route.data}
          origin={origin}
          destination={destination}
        />
      )}
    </div>
  );
}
