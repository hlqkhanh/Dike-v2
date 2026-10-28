import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect, router } from "expo-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import type { RidePostResponse, RidePostView } from "@dike/api-client-ts";
import { dateTime, statusLabel, useMobileApi } from "@/core/hooks";
import { theme } from "@/core/theme";
import { ResourceState } from "./ResourceState";
import { PostResponseCard } from "./PostResponseCard";
import { Button, Icon, Text, ui } from "./ui";

export function ActivePostResponses({
  compact = false,
  floating = false,
  bottomOffset = 84,
}: {
  compact?: boolean;
  floating?: boolean;
  bottomOffset?: number;
}) {
  const api = useMobileApi();
  const [focused, setFocused] = useState(true);
  const query = useQuery({
    queryKey: ["mobile-active-responses"],
    queryFn: () => api.call<RidePostResponse[]>("/ride-post-responses/active"),
    enabled: focused,
    refetchInterval: focused ? 15000 : false,
  });
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      void query.refetch();
      return () => setFocused(false);
    }, [query.refetch]),
  );
  const rows = query.data ?? [];
  const postQueries = useQueries({
    queries: rows.map((row) => ({
      queryKey: ["mobile-floating-active-post", row.postId],
      queryFn: () => api.post(row.postId),
      enabled: floating,
      staleTime: 30_000,
    })),
  });
  const nearest = rows
    .map((response, index) => ({ response, post: postQueries[index]?.data }))
    .filter(
      (item): item is { response: RidePostResponse; post: RidePostView } =>
        Boolean(item.post) && Date.parse(item.post!.departureAt) >= Date.now(),
    )
    .sort(
      (left, right) =>
        Date.parse(left.post.departureAt) - Date.parse(right.post.departureAt),
    )[0];
  const active = nearest?.response;
  const activePost = nearest?.post;
  const passenger = activePost?.type === "NEED_RIDE";
  const accent = passenger ? theme.colors.passenger : theme.colors.primary;
  if (floating) {
    if (!active) return null;
    return (
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Mở chi tiết chuyến đi gần nhất"
        onPress={() =>
          router.push({
            pathname: "/posts/[id]",
            params: { id: active.postId, responseId: active.id },
          })
        }
        style={({ pressed }) => [
          styles.floatingTab,
          {
            bottom: bottomOffset,
            borderColor: accent,
            backgroundColor: passenger
              ? theme.colors.passengerSoft
              : "rgba(255,255,255,.97)",
          },
          pressed && { opacity: 0.86 },
        ]}
      >
        <View style={styles.floatingCopy}>
          <View style={styles.floatingHeading}>
            <View style={[styles.floatingIcon, { backgroundColor: accent }]}>
              <Icon name="navigate-outline" size={17} color="#fff" />
            </View>
            <Text numberOfLines={1} style={styles.floatingTitle}>Chuyến đi gần nhất</Text>
            <View style={[styles.statusPill, { backgroundColor: passenger ? "#fff1bd" : "#e8f7f1" }]}>
              <Text numberOfLines={1} style={[styles.floatingStatus, { color: passenger ? theme.colors.passengerInk : theme.colors.primary }]}>{statusLabel(active.status)}</Text>
            </View>
          </View>
          {activePost ? (
            <>
              <View style={styles.routeRow}>
                <Icon name="location-outline" size={15} color={accent} />
                <Text numberOfLines={1} style={styles.routeText}>{activePost.originLabel}</Text>
                <Icon name="arrow-forward" size={14} color={theme.colors.inkMuted} />
                <Text numberOfLines={1} style={styles.routeText}>{activePost.destinationLabel}</Text>
              </View>
              <View style={styles.metaRow}>
                <Icon name="calendar-outline" size={14} color={theme.colors.inkMuted} />
                <Text style={styles.metaText}>{dateTime(activePost.departureAt)}</Text>
                <Icon name={activePost.vehicleType === "CAR" ? "car-outline" : "bicycle-outline"} size={15} color={theme.colors.inkMuted} />
                <Text style={styles.metaText}>{activePost.vehicleType === "CAR" ? "Ô tô" : "Xe máy"}</Text>
              </View>
            </>
          ) : null}
        </View>
        <Icon name="chevron-forward" size={19} color={accent} />
      </Pressable>
    );
  }
  if (compact && query.isSuccess && !rows.length) return null;
  return (
    <>
      <Text style={ui.sectionTitle}>Tiếp tục hành trình đi cùng</Text>
      <ResourceState query={query}>
        {(compact ? rows.slice(0, 1) : rows).map((r) => (
          <PostResponseCard key={r.id} response={r} />
        ))}
        {!rows.length ? (
          <Text style={ui.muted}>Chưa có yêu cầu đi cùng đã được đồng ý.</Text>
        ) : null}
        {compact && rows.length > 1 ? (
          <Button
            label={`Xem ${rows.length} hành trình đi cùng`}
            variant="secondary"
            onPress={() => router.push("/(tabs)/trips")}
          />
        ) : null}
      </ResourceState>
    </>
  );
}

const styles = StyleSheet.create({
  floatingTab: {
    position: "absolute",
    left: 14,
    right: 14,
    zIndex: 20,
    minHeight: 86,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "rgba(255,255,255,.96)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    ...theme.shadow.card,
  },
  floatingIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
  },
  floatingCopy: { flex: 1, minWidth: 0, gap: 6 },
  floatingHeading: { flexDirection: "row", alignItems: "center", gap: 8 },
  floatingTitle: { flex: 1, color: theme.colors.ink, fontSize: 13, fontWeight: "800" },
  statusPill: { maxWidth: 115, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: "#e8f7f1" },
  floatingStatus: { color: theme.colors.primary, fontSize: 9, fontWeight: "800" },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  routeText: { flex: 1, color: theme.colors.ink, fontSize: 10, fontWeight: "700" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { marginRight: 8, color: theme.colors.inkMuted, fontSize: 9 },
});
