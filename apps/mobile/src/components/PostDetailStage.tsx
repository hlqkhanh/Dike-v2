import type {
  RidePostView,
  RidePostRoute,
  RidePostResponse,
  PickupCheck,
  PlaceResponse,
  RouteResponse,
} from "@dike/api-client-ts";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { theme } from "@/core/theme";
import { useSession } from "@/core/session";
import { mapMember } from "@/core/map-member";
import { useMobileApi } from "@/core/hooks";
import { splitPlaceLabel } from "@/core/place-label";
import { RouteMapSurface } from "./RouteMapSurface";
import { DetailPage } from "./DetailPage";
import { MergedJourneyStops } from "./MergedJourneyStops";
import { RidePostCard } from "./RidePostCard";
import { RideComposerSheet } from "./RideComposerSheet";
import { PostJourneySummary, PostJourneyHeading } from "./PostJourneySummary";
import { Icon, Text } from "./ui";

export function PostDetailStage({
  post,
  own,
  onMenu,
  expandSignal,
  initialSnap,
  refreshSignal,
  children,
  selected,
  confirmedResponse,
  selectionSignal,
  onDecision,
  onClearSelection,
  draftPickup,
  draftDropoff,
  draftCheck,
  draftRoute,
}: PropsWithChildren<{
  post?: RidePostView;
  draftPickup?: PlaceResponse;
  draftDropoff?: PlaceResponse;
  draftCheck?: PickupCheck;
  draftRoute?: RouteResponse;
  selected?: RidePostResponse;
  confirmedResponse?: RidePostResponse;
  selectionSignal: number;
  onDecision: (value: string) => void;
  onClearSelection: () => void;
  own: boolean;
  onMenu: () => void;
  expandSignal: number;
  initialSnap: 0 | 1 | 2;
  refreshSignal: number;
}>) {
  const api = useMobileApi();
  const { session } = useSession();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const fullMapSize = useRef({ height, width });
  if (
    width !== fullMapSize.current.width ||
    height > fullMapSize.current.height
  )
    fullMapSize.current = { height, width };
  const mapHeight = fullMapSize.current.height;
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(140);
  const [summaryCollapsed, setSummaryCollapsed] = useState(true);
  const route = useQuery({
    queryKey: ["mobile-post-route", post?.id],
    queryFn: () =>
      api.call<RidePostRoute>(
        "/ride-posts/" + encodeURIComponent(post!.id) + "/route",
      ),
    enabled: !!post,
    staleTime: 5 * 60_000,
  });
  const fractions = useMemo(
    () =>
      [
        0.18,
        own ? 0.34 : 0.4,
        Math.max(0.45, 1 - (insets.top + headerHeight + 20) / height),
      ] as const,
    [height, insets.top, headerHeight, own],
  );
  const shownResponse = selected ?? confirmedResponse;
  const check = shownResponse?.pickupCheck ?? draftCheck;
  const geometry = check?.geometry?.length
    ? check.geometry
    : route.data?.geometry;
  const presentation = useMemo(
    () => ({
      style: "positron" as const,
      showLabels: false,
      memberColors: true,
      directionMarkers: true,
      owner: mapMember(
        post?.ownerId ?? "owner",
        post?.ownerDisplayName ?? "",
        post?.ownerAvatarUrl,
      ),
      requester: shownResponse
        ? mapMember(
            shownResponse.requesterId,
            shownResponse.requesterDisplayName,
            shownResponse.requesterAvatarUrl,
          )
        : mapMember(
            session?.user.id ?? "viewer",
            session?.user.displayName ?? "",
            session?.user.avatarUrl,
          ),
      extraStops:
        !shownResponse && !check?.geometry?.length
          ? [
              ...(draftPickup
                ? [{ ...draftPickup, kind: "origin" as const }]
                : []),
              ...(draftDropoff
                ? [{ ...draftDropoff, kind: "destination" as const }]
                : []),
            ]
          : undefined,
      extraGeometry:
        !shownResponse && post?.type === "NEED_RIDE"
          ? draftRoute?.geometry
          : undefined,
      request: check?.geometry?.length
        ? {
            pickup: check.pickup,
            dropoff: check.dropoff,
            pickupIndex: check.pickupIndex,
            dropoffIndex: check.dropoffIndex,
          }
        : undefined,
      labels: {
        origin: splitPlaceLabel(post?.originLabel ?? "").name,
        destination: splitPlaceLabel(post?.destinationLabel ?? "").name,
      },
    }),
    [
      post?.originLabel,
      post?.destinationLabel,
      post?.type,
      post?.ownerId,
      post?.ownerDisplayName,
      post?.ownerAvatarUrl,
      session?.user.id,
      session?.user.displayName,
      session?.user.avatarUrl,
      check,
      shownResponse,
      draftPickup,
      draftDropoff,
      draftRoute,
    ],
  );
  const viewport = useMemo(
    () => ({
      topInset: insets.top + headerHeight + 12,
      bottomInset: mapHeight * (own ? 0.34 : 0.4) + 12,
    }),
    [insets.top, headerHeight, mapHeight, own],
  );
  const handleError = useCallback(() => setFailed(true), []);
  useEffect(() => {
    setFailed(false);
    setAttempt((value) => value + 1);
  }, [refreshSignal]);
  useEffect(() => {
    setFailed(false);
  }, [
    selected?.id,
    draftPickup?.placeRef,
    draftDropoff?.placeRef,
    draftCheck?.id,
    draftRoute?.id,
  ]);
  if (post && confirmedResponse && selected?.status !== "PENDING") {
    return (
      <DetailPage title="Chi tiết hành trình" compact backgroundColor="#fff">
        <View testID="confirmed-post-detail">
          <RidePostCard
            post={post}
            viewerId={session?.user.id}
            detailed
            routeFields={
              <MergedJourneyStops
                post={post}
                response={confirmedResponse}
                ownerGeometry={route.data?.geometry}
              />
            }
            onMenu={onMenu}
            statusText={
              confirmedResponse.status === "COMPLETED"
                ? "Đã hoàn thành"
                : "Đã ghép chuyến"
            }
            routePreview={
              <View style={{ height: 220 }} testID="confirmed-route-map">
                {failed || !geometry?.length ? (
                  <View style={styles.mapState}>
                    {route.isPending ? (
                      <ActivityIndicator color={theme.colors.primary} />
                    ) : (
                      <Text style={styles.muted}>Chưa tải được bản đồ</Text>
                    )}
                    {!route.isPending ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Thử tải lại bản đồ"
                        onPress={() => {
                          setFailed(false);
                          setAttempt((value) => value + 1);
                          void route.refetch();
                        }}
                      >
                        <Text style={styles.retryText}>Thử lại</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : (
                  <RouteMapSurface
                    key={attempt}
                    geometry={geometry}
                    passenger={post.type === "NEED_RIDE"}
                    presentation={presentation}
                    onError={handleError}
                  />
                )}
              </View>
            }
          />
        </View>
        {children}
      </DetailPage>
    );
  }
  return (
    <KeyboardAvoidingView
      style={styles.stage}
      enabled={Platform.OS !== "web"}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      testID="post-detail-stage"
    >
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: mapHeight,
        }}
        testID="post-detail-map"
      >
        {!geometry && route.isPending ? (
          <View style={styles.mapState}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : failed || !geometry?.length ? (
          <View style={styles.mapState}>
            <Icon name="map-outline" size={28} />
            <Text style={styles.muted}>Chưa tải được bản đồ</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Thử tải lại bản đồ"
              style={styles.retry}
              onPress={() => {
                setFailed(false);
                setAttempt((value) => value + 1);
                void route.refetch();
              }}
            >
              <Text style={styles.retryText}>Thử lại</Text>
            </Pressable>
          </View>
        ) : (
          <RouteMapSurface
            key={attempt}
            geometry={geometry}
            passenger={post?.type === "NEED_RIDE"}
            interactive
            presentation={presentation}
            viewport={viewport}
            onError={handleError}
            onMapPress={onClearSelection}
          />
        )}
      </View>
      <View
        onStartShouldSetResponderCapture={() => {
          onClearSelection();
          return false;
        }}
        onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
        style={[styles.header, { top: insets.top + 8 }]}
        testID="post-floating-header"
      >
        <View style={styles.navigation}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
            style={styles.back}
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/(tabs)")
            }
          >
            <Icon name="arrow-back" size={23} />
          </Pressable>
          <PostJourneyHeading
            post={post}
            collapsed={summaryCollapsed}
            onToggle={() => setSummaryCollapsed((value) => !value)}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mở tùy chọn bài đăng"
            style={styles.settings}
            onPress={onMenu}
          >
            <Icon name="ellipsis-horizontal" size={23} />
          </Pressable>
        </View>
        {post ? (
          <PostJourneySummary post={post} collapsed={summaryCollapsed} />
        ) : null}
      </View>
      {selected || draftPickup || draftDropoff ? (
        <View
          pointerEvents="none"
          style={[styles.legend, { top: insets.top + headerHeight + 14 }]}
        >
          <View
            style={[
              styles.legendDot,
              { backgroundColor: theme.colors.primary },
            ]}
          />
          <Text style={styles.legendText}>Điểm đến</Text>
          <View style={[styles.legendDot, { backgroundColor: "#e9bd52" }]} />
          <Text style={styles.legendText}>Điểm đi</Text>
        </View>
      ) : null}
      <RideComposerSheet
        testID="post-detail-sheet"
        initialSnap={initialSnap}
        expandOnKeyboard={false}
        fitToContent={!own}
        syncKeyboardCollapse
        snapFractions={fractions}
        expandSignal={expandSignal}
        collapseSignal={selectionSignal}
        onBackgroundPress={onClearSelection}
        handleHeight={32}
        bodyStyle={{
          padding: 0,
          paddingBottom: own
            ? insets.bottom + (selected?.status === "PENDING" ? 130 : 24)
            : 8,
          gap: 0,
        }}
      >
        {children}
      </RideComposerSheet>
      {own && selected?.status === "PENDING" ? (
        <View
          style={[styles.decisionBar, { paddingBottom: insets.bottom + 10 }]}
          testID="request-decision-bar"
        >
          <Text style={styles.decisionName} numberOfLines={1}>
            {selected.requesterDisplayName}
          </Text>
          <View style={styles.decisionActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Từ chối"
              onPress={() => onDecision("REJECTED")}
              style={styles.reject}
            >
              <Text style={styles.rejectText}>Từ chối</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Chấp nhận"
              onPress={() => onDecision("ACCEPTED")}
              style={styles.accept}
            >
              <Text style={styles.acceptText}>Chấp nhận</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  legend: {
    position: "absolute",
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontSize: 9, color: theme.colors.ink, marginRight: 4 },
  decisionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderColor: "#e3e9e6",
    ...theme.shadow.card,
  },
  decisionName: { fontSize: 12, fontWeight: "700", textAlign: "center" },
  decisionActions: { flexDirection: "row", gap: 10 },
  reject: {
    flex: 1,
    minHeight: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: "#d6a1a1",
    alignItems: "center",
    justifyContent: "center",
  },
  accept: {
    flex: 1,
    minHeight: 46,
    borderRadius: 23,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  rejectText: { color: "#b43232", fontWeight: "700", fontSize: 13 },
  acceptText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  stage: { flex: 1, backgroundColor: "#e4efe9" },
  header: {
    position: "absolute",
    left: 12,
    right: 12,
    borderRadius: 22,
    backgroundColor: "#fff",
    ...theme.shadow.card,
  },
  navigation: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 6,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e9efeb",
  },
  settings: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  muted: { fontSize: 11, color: theme.colors.inkMuted },
  mapState: {
    height: "55%",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  retry: {
    minHeight: 40,
    paddingHorizontal: 18,
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 20,
  },
  retryText: { color: theme.colors.primary, fontSize: 12, fontWeight: "700" },
});
