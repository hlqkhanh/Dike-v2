import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import type { RidePostRoute } from "@dike/api-client-ts";
import { RouteMapSurface } from "@/components/RouteMapSurface";
import { Icon, Text } from "@/components/ui";
import { useMobileApi } from "@/core/hooks";
import {
  expandedMapKey,
  type ExpandedRouteMap,
} from "@/core/expanded-route-map";
import { mapMember } from "@/core/map-member";
import { theme } from "@/core/theme";

export default function ExpandedRouteMapScreen() {
  const { postId = "", responseId = "" } = useLocalSearchParams<{
    postId: string;
    responseId?: string;
  }>();
  const api = useMobileApi();
  const insets = useSafeAreaInsets();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const scene = useQuery<ExpandedRouteMap>({
    queryKey: expandedMapKey(postId, responseId),
    staleTime: Infinity,
    enabled: !!postId,
    queryFn: async () => {
      const [post, route, responses] = await Promise.all([
        api.post(postId),
        api.call<RidePostRoute>(
          "/ride-posts/" + encodeURIComponent(postId) + "/route",
        ),
        responseId ? api.postResponses(postId) : Promise.resolve([]),
      ]);
      const response = responses.find((item) => item.id === responseId);
      const check = response?.pickupCheck;
      return {
        geometry: check?.geometry?.length ? check.geometry : route.geometry,
        passenger: post.type === "NEED_RIDE",
        presentation: {
          style: "positron",
          memberColors: true,
          directionMarkers: true,
          labels: {
            origin: post.originLabel,
            destination: post.destinationLabel,
          },
          owner: mapMember(
            post.ownerId,
            post.ownerDisplayName,
            post.ownerAvatarUrl,
          ),
          requester: response
            ? mapMember(
                response.requesterId,
                response.requesterDisplayName,
                response.requesterAvatarUrl,
              )
            : undefined,
          request: check?.geometry?.length
            ? {
                pickup: check.pickup,
                dropoff: check.dropoff,
                pickupIndex: check.pickupIndex,
                dropoffIndex: check.dropoffIndex,
              }
            : undefined,
        },
      };
    },
  });
  const presentation = useMemo(
    () => ({
      ...scene.data?.presentation,
      topInset: insets.top + 60,
      bottomInset: insets.bottom + 8,
      allowSatellite: true,
      showLabels: true,
    }),
    [scene.data?.presentation, insets.top, insets.bottom],
  );
  const back = () =>
    router.canGoBack()
      ? router.back()
      : router.replace({ pathname: "/posts/[id]", params: { id: postId } });
  const retry = () => {
    setFailed(false);
    setAttempt((value) => value + 1);
    if (scene.isError) void scene.refetch();
  };
  return (
    <View style={styles.screen} testID="expanded-route-map">
      {!failed && scene.data?.geometry?.length ? (
        <RouteMapSurface
          key={attempt}
          geometry={scene.data.geometry}
          presentation={presentation}
          passenger={scene.data.passenger}
          interactive
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={styles.state}>
          {scene.isPending ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : (
            <>
              <Text>Chưa tải được bản đồ</Text>
              <Pressable
                accessibilityRole="button"
                onPress={retry}
                style={styles.retry}
              >
                <Text>Thử lại</Text>
              </Pressable>
            </>
          )}
        </View>
      )}
      <View style={[styles.header, { top: insets.top + 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          onPress={back}
          style={styles.back}
        >
          <Icon name="arrow-back" size={23} />
        </Pressable>
        <Text style={styles.title}>Bản đồ hành trình</Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#edf1ee" },
  header: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 6,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.97)",
    ...theme.shadow.card,
  },
  back: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 16, fontWeight: "700" },
  state: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  retry: { padding: 12, borderRadius: 14, backgroundColor: "#fff" },
});
