import type { RidePostRoute } from "@dike/api-client-ts";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { MobileApiError } from "@/core/api";
import { useMobileApi } from "@/core/hooks";
import { homeTheme as h } from "@/core/home-theme";
import { Icon, Text } from "./ui";
import { RouteMapSurface } from "./RouteMapSurface";

export function PostRoutePreview({ postId }: { postId: string }) {
  const api = useMobileApi();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const route = useQuery({
    queryKey: ["mobile-post-route", postId],
    queryFn: () =>
      api.call<RidePostRoute>(
        `/ride-posts/${encodeURIComponent(postId)}/route`,
      ),
    staleTime: 5 * 60_000,
    retry: (count, error) =>
      error instanceof MobileApiError &&
      error.code === "POST_ROUTE_CALCULATING" &&
      count < 3,
    retryDelay: 2000,
  });
  const geometry =
    route.data?.geometry.filter(
      (point) =>
        Number.isFinite(point.latitude) &&
        Number.isFinite(point.longitude) &&
        Math.abs(point.latitude) <= 85 &&
        Math.abs(point.longitude) <= 180,
    ) ?? [];
  const loading = route.isPending || (route.isFetching && geometry.length < 2);
  return (
    <View
      style={styles.shell}
      accessibilityLabel={
        geometry.length >= 2 && !failed
          ? "Bản đồ tuyến đường thực tế"
          : "Bản đồ tuyến đường"
      }
    >
      {loading ? (
        <ActivityIndicator size="small" color={h.primary} />
      ) : failed || geometry.length < 2 ? (
        <>
          <Icon name="map-outline" size={20} color={h.muted} />
          <Text style={styles.unavailable}>
            {failed ? "Không tải được nền bản đồ" : "Chưa có tuyến đường"}
          </Text>
          <Text
            accessibilityRole="button"
            accessibilityLabel="Thử tải lại bản đồ"
            style={styles.retry}
            onPress={(event) => {
              event.stopPropagation();
              setFailed(false);
              setAttempt((value) => value + 1);
              void route.refetch();
            }}
          >
            Thử lại
          </Text>
        </>
      ) : (
        <RouteMapSurface
          key={attempt}
          geometry={geometry}
          onError={() => setFailed(true)}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  shell: {
    width: 100,
    height: 100,
    alignSelf: "center",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: h.mapCanvas,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  unavailable: {
    fontSize: 10,
    color: h.muted,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  retry: {
    fontSize: 10,
    color: h.primary,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
