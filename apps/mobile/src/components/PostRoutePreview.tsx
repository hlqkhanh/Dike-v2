import type { RidePostRoute } from "@dike/api-client-ts";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useMapViewport } from "@/core/map-viewport";
import { MobileApiError } from "@/core/api";
import { useMobileApi } from "@/core/hooks";
import { theme } from "@/core/theme";
import { homeTheme as h } from "@/core/home-theme";
import { Icon, Text } from "./ui";
import { RouteMapSurface } from "./RouteMapSurface";

export function PostRoutePreview({
  postId,
  style,
  passenger = false,
}: {
  postId: string;
  passenger?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const api = useMobileApi();
  const viewport = useMapViewport();
  const handleError = useCallback(() => setFailed(true), []);
  const accent = passenger ? theme.colors.passengerInk : h.primary;
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const route = useQuery({
    queryKey: ["mobile-post-route", postId],
    queryFn: () =>
      api.call<RidePostRoute>(
        `/ride-posts/${encodeURIComponent(postId)}/route`,
      ),
    staleTime: 5 * 60_000,
    enabled: viewport.active,
    retry: (count, error) =>
      error instanceof MobileApiError &&
      error.code === "POST_ROUTE_CALCULATING" &&
      count < 3,
    retryDelay: 2000,
  });
  const geometry = useMemo(
    () =>
      route.data?.geometry.filter(
        (point) =>
          Number.isFinite(point.latitude) &&
          Number.isFinite(point.longitude) &&
          Math.abs(point.latitude) <= 85 &&
          Math.abs(point.longitude) <= 180,
      ) ?? [],
    [route.data?.geometry],
  );
  const loading = route.isPending || (route.isFetching && geometry.length < 2);
  return (
    <View
      ref={viewport.ref}
      collapsable={false}
      onLayout={viewport.onLayout}
      testID="post-route-preview"
      style={[
        styles.shell,
        passenger && { backgroundColor: theme.colors.passengerSoft },
        style,
      ]}
      accessibilityLabel={
        geometry.length >= 2 && !failed
          ? "Bản đồ tuyến đường thực tế"
          : "Bản đồ tuyến đường"
      }
    >
      {!viewport.active ? (
        <Icon name="map-outline" size={20} color={h.muted} />
      ) : loading ? (
        <ActivityIndicator size="small" color={accent} />
      ) : failed || geometry.length < 2 ? (
        <>
          <Icon name="map-outline" size={20} color={h.muted} />
          <Text style={styles.unavailable}>
            {failed ? "Không tải được nền bản đồ" : "Chưa có tuyến đường"}
          </Text>
          <Text
            accessibilityRole="button"
            accessibilityLabel="Thử tải lại bản đồ"
            style={[styles.retry, { color: accent }]}
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
          passenger={passenger}
          onError={handleError}
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
