import type {
  RidePostView,
  RidePostRoute,
  RidePostResponse,
  PickupCheck,
  PlaceResponse,
  RouteResponse,
  RoutePoint,
} from "@dike/api-client-ts";
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { expandedMapKey } from "@/core/expanded-route-map";
import { router } from "expo-router";
import { theme } from "@/core/theme";
import { useSession } from "@/core/session";
import { mapMember } from "@/core/map-member";
import { useMobileApi } from "@/core/hooks";
import { splitPlaceLabel } from "@/core/place-label";
import { RouteMapSurface } from "./RouteMapSurface";
import journeyLandscape from "../../../web/public/images/Phong cảnh đồi núi pastel tối giản.png";
import { LinearGradient } from "expo-linear-gradient";
import { BlurTargetView } from "expo-blur";
import { JourneyBlurTarget, JourneyGlass } from "./JourneyGlass";
import { RideComposerSheet } from "./RideComposerSheet";
import { PostJourneySummary, PostJourneyHeading } from "./PostJourneySummary";
import { Avatar, Icon, Text } from "./ui";
import { nextRideStatus } from "./RideProgress";
import { dateTime, money } from "@/core/hooks";

const JourneyDetailsVisibility = createContext(true);

export function JourneyDetailsContent({ children }: PropsWithChildren) {
  return useContext(JourneyDetailsVisibility) ? <>{children}</> : null;
}

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
  journeyProgress,
  onJourneyAdvance,
  onJourneyChat,
  chatPending,
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
  journeyProgress?: (geometry?: RoutePoint[]) => ReactNode;
  onJourneyAdvance?: (status: string) => void;
  onJourneyChat?: () => void;
  chatPending?: boolean;
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
  const queryClient = useQueryClient();
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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const blurTarget = useRef<View | null>(null);
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
    const owner = {
      id: post.ownerId,
      name: post.ownerDisplayName,
      avatarUrl: post.ownerAvatarUrl,
    };
    const requester = {
      id: confirmedResponse.requesterId,
      name: confirmedResponse.requesterDisplayName,
      avatarUrl: confirmedResponse.requesterAvatarUrl,
    };
    const driver = post.type === "OFFER_RIDE" ? owner : requester;
    const passenger = post.type === "OFFER_RIDE" ? requester : owner;
    const accent = theme.colors.primary;
    const actionInk = accent;
    const actionBackground = "rgba(221,243,233,0.85)";
    const divider = "#d8ebe2";
    const next =
      session?.user.id === driver.id
        ? nextRideStatus[confirmedResponse.status]
        : undefined;
    const openMap = () => {
      if (!geometry?.length) return;
      queryClient.setQueryData(expandedMapKey(post.id, confirmedResponse.id), {
        geometry,
        presentation,
        passenger: post.type === "NEED_RIDE",
      });
      router.push({
        pathname: "/route-map",
        params: { postId: post.id, responseId: confirmedResponse.id },
      });
    };
    const callCompanion = async () => {
      const phone = confirmedResponse.companionPhone?.replace(/[^+0-9]/g, "");
      if (!phone) {
        Alert.alert(
          "Chưa có số điện thoại",
          "Người đồng hành chưa cập nhật số điện thoại. Bạn có thể nhắn tin để liên hệ.",
        );
        return;
      }
      try {
        await Linking.openURL("tel:" + phone);
      } catch {
        Alert.alert("Không thể mở cuộc gọi", "Vui lòng thử lại sau.");
      }
    };
    return (
      <View style={styles.confirmedStage}>
        <JourneyBlurTarget.Provider value={blurTarget}>
          <BlurTargetView
            ref={blurTarget}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          >
            <Image
              source={journeyLandscape}
              style={[
                StyleSheet.absoluteFill,
                { width: "100%", height: "100%" },
              ]}
              resizeMode="stretch"
            />
            <LinearGradient
              pointerEvents="none"
              colors={["rgba(255,255,255,0.9)", "rgba(240,251,247,0)"]}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                height: 230,
              }}
            />
          </BlurTargetView>
          <ScrollView
            contentInsetAdjustmentBehavior="never"
            contentContainerStyle={{
              paddingTop: insets.top,
              paddingBottom: insets.bottom + 24,
            }}
          >
            <View style={styles.confirmedCard} testID="confirmed-post-detail">
              <View style={styles.journeyNav}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Quay lại"
                  style={styles.scenicNavButton}
                  onPress={() =>
                    router.canGoBack()
                      ? router.back()
                      : router.replace("/(tabs)")
                  }
                >
                  <JourneyGlass radius={19} />
                  <Icon name="arrow-back" size={23} />
                </Pressable>
                <Text accessibilityRole="header" style={styles.navTitle}>
                  Chi tiết hành trình
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Mở tùy chọn bài đăng"
                  style={styles.scenicNavButton}
                  onPress={onMenu}
                >
                  <JourneyGlass radius={19} />
                  <Icon
                    name="settings-outline"
                    size={22}
                    color={theme.colors.inkMuted}
                  />
                </Pressable>
              </View>
              <View style={styles.journeySummary}>
                <JourneyGlass radius={26} />
                <LinearGradient
                  pointerEvents="none"
                  colors={["rgba(246,255,250,0.2)", "rgba(207,245,222,0.3)"]}
                  style={StyleSheet.absoluteFill}
                />
                <Pressable
                  style={styles.journeyIdentity}
                  testID="ride-post-card"
                  accessibilityRole="button"
                  accessibilityLabel={
                    detailsOpen
                      ? "Thu gọn thông tin hành trình"
                      : "Mở thông tin hành trình"
                  }
                  accessibilityState={{ expanded: detailsOpen }}
                  onPress={() => setDetailsOpen((value) => !value)}
                >
                  <View
                    style={[styles.journeyMember, { width: (width - 98) / 2 }]}
                    testID="journey-driver"
                  >
                    <Avatar
                      userId={driver.id}
                      name={driver.name}
                      uri={driver.avatarUrl}
                      size={42}
                    />
                    <View style={styles.memberCopy}>
                      <Text
                        userId={driver.id}
                        numberOfLines={1}
                        style={styles.journeyOwner}
                      >
                        {driver.name.trim().split(/\s+/).pop()}
                      </Text>
                      <View style={styles.scenicRole}>
                        <Icon name="car-outline" size={12} />
                        <Text style={styles.scenicRoleText}>Tôi chở</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.journeyConnection}>
                    <View style={styles.connectionLine}>
                      <View style={styles.connectionDash} />
                      <Icon name="link-outline" size={18} color={accent} />
                      <View style={styles.connectionDash} />
                    </View>
                    <Text style={styles.connectionTime}>
                      {new Date(post.departureAt).toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                    <Text style={styles.connectionDate}>
                      {new Date(post.departureAt).toLocaleDateString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </Text>
                    <Icon
                      name={detailsOpen ? "chevron-up" : "chevron-down"}
                      size={12}
                      color={theme.colors.inkMuted}
                    />
                  </View>
                  <View
                    style={[
                      styles.journeyMember,
                      styles.passengerMember,
                      { width: (width - 98) / 2 },
                    ]}
                    testID="journey-passenger"
                  >
                    <View style={[styles.memberCopy, styles.passengerCopy]}>
                      <Text
                        userId={passenger.id}
                        numberOfLines={1}
                        style={styles.journeyOwner}
                      >
                        {passenger.name.trim().split(/\s+/).pop()}
                      </Text>
                      <View style={[styles.scenicRole, styles.passengerRole]}>
                        <Icon name="person-outline" size={12} color="#d9a51b" />
                        <Text
                          style={[
                            styles.scenicRoleText,
                            styles.passengerRoleText,
                          ]}
                        >
                          Tôi đi ké
                        </Text>
                      </View>
                    </View>
                    <Avatar
                      userId={passenger.id}
                      name={passenger.name}
                      uri={passenger.avatarUrl}
                      size={42}
                    />
                  </View>
                </Pressable>
                <View style={styles.journeyActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Nhắn tin"
                    disabled={chatPending}
                    onPress={() =>
                      confirmedResponse.conversationId
                        ? router.push({
                            pathname: "/chat/[id]",
                            params: { id: confirmedResponse.conversationId },
                          })
                        : onJourneyChat?.()
                    }
                    style={[
                      styles.journeyAction,
                      { backgroundColor: actionBackground },
                      chatPending && { opacity: 0.5 },
                    ]}
                  >
                    <Icon
                      name="chatbubble-ellipses-outline"
                      size={17}
                      color={accent}
                    />
                    <Text
                      style={[styles.journeyActionText, { color: actionInk }]}
                    >
                      Nhắn tin
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Gọi điện"
                    onPress={() => void callCompanion()}
                    style={[
                      styles.journeyAction,
                      { backgroundColor: actionBackground },
                    ]}
                  >
                    <Icon name="call-outline" size={17} color={accent} />
                    <Text
                      style={[styles.journeyActionText, { color: actionInk }]}
                    >
                      Gọi
                    </Text>
                  </Pressable>
                  {next ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={next.label}
                      onPress={() => onJourneyAdvance?.(next.status)}
                      style={[styles.journeyAction, styles.advanceAction]}
                    >
                      <Icon name="navigate-outline" size={17} color="#fff" />
                      <Text
                        style={[styles.journeyActionText, { color: "#fff" }]}
                      >
                        Cập nhật
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                {next ? (
                  <Text style={styles.nextStatusHint}>{next.label}</Text>
                ) : null}
                {detailsOpen ? (
                  <View testID="journey-summary-details" style={{ zIndex: 1 }}>
                    <View style={[styles.mapTicket, { borderColor: divider }]}>
                      <View
                        style={styles.summaryMap}
                        testID="confirmed-route-map"
                      >
                        {failed || !geometry?.length ? (
                          <View style={[styles.mapState, { height: "100%" }]}>
                            {route.isPending ? (
                              <ActivityIndicator color={theme.colors.primary} />
                            ) : (
                              <Text style={styles.muted}>
                                Chưa tải được bản đồ
                              </Text>
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
                            onMapPress={openMap}
                            onError={handleError}
                          />
                        )}
                      </View>
                      <View style={[styles.mapFacts, { borderColor: divider }]}>
                        {[
                          {
                            icon: "time-outline" as const,
                            text: dateTime(post.departureAt),
                          },
                          {
                            icon: "cash-outline" as const,
                            text:
                              post.contributionPerKm == null
                                ? "Thỏa thuận"
                                : money(post.contributionPerKm) + "/km",
                          },
                          {
                            icon:
                              post.vehicleType === "CAR"
                                ? ("car-outline" as const)
                                : ("bicycle-outline" as const),
                            text:
                              post.vehicleType === "CAR" ? "Ô tô" : "Xe máy",
                          },
                        ].map((fact, index) => (
                          <View
                            key={fact.icon}
                            style={[
                              styles.mapFact,
                              index > 0 && styles.mapFactDivider,
                              { borderColor: divider },
                            ]}
                          >
                            <Icon name={fact.icon} size={14} color={accent} />
                            <Text numberOfLines={1} style={styles.mapFactValue}>
                              {fact.text}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                    <View style={styles.mapEstimate}>
                      <Text style={styles.detourText}>
                        +
                        {(
                          (confirmedResponse.requestSummary?.extraMeters ??
                            confirmedResponse.pickupCheck?.extraMeters ??
                            0) / 1000
                        ).toLocaleString("vi-VN", {
                          maximumFractionDigits: 2,
                        })}{" "}
                        km · +
                        {Math.ceil(
                          (confirmedResponse.requestSummary?.extraSeconds ??
                            confirmedResponse.pickupCheck?.extraSeconds ??
                            0) / 60,
                        )}{" "}
                        phút
                      </Text>
                      <View style={styles.estimatePrice}>
                        <Text
                          style={[styles.estimateText, { color: actionInk }]}
                        >
                          {confirmedResponse.requestSummary
                            ?.estimatedAmountVnd != null ||
                          confirmedResponse.pickupCheck?.estimatedAmountVnd !=
                            null
                            ? money(
                                confirmedResponse.requestSummary
                                  ?.estimatedAmountVnd ??
                                  confirmedResponse.pickupCheck
                                    ?.estimatedAmountVnd,
                              )
                            : "Thỏa thuận"}
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : null}
                <JourneyDetailsVisibility.Provider value={detailsOpen}>
                  <View style={{ zIndex: 1 }}>{children}</View>
                </JourneyDetailsVisibility.Provider>
              </View>
              <View style={styles.progressHeader}>
                {journeyProgress?.(route.data?.geometry)}
              </View>
            </View>
          </ScrollView>
        </JourneyBlurTarget.Provider>
      </View>
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
          <Text
            userId={selected.requesterId}
            style={styles.decisionName}
            numberOfLines={1}
          >
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
  confirmedStage: { flex: 1, backgroundColor: "#eaf5e5" },
  confirmedCard: {
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  progressHeader: {
    paddingTop: 24,
  },
  journeyNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  scenicNavButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "#c5e9dc",
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadow.card,
  },
  navTitle: { fontSize: 17, fontWeight: "700", color: theme.colors.ink },
  scenicRole: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    backgroundColor: "rgba(209,240,224,0.65)",
    borderRadius: 22,
  },
  scenicRoleText: {
    color: theme.colors.primary,
    fontSize: 10,
    fontWeight: "700",
  },
  journeySummary: {
    marginHorizontal: 6,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#fff",
  },
  journeyIdentity: {
    zIndex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 12,
    minHeight: 56,
  },
  journeyOwner: { fontSize: 13, fontWeight: "700", color: theme.colors.ink },
  journeyMember: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  memberCopy: { flex: 1, minWidth: 0, alignItems: "flex-start", gap: 4 },
  passengerMember: { justifyContent: "flex-end" },
  passengerCopy: { alignItems: "flex-end" },
  passengerRole: { backgroundColor: "rgba(255,241,181,0.8)" },
  passengerRoleText: { color: "#d9a51b" },
  journeyConnection: { width: 50, flexShrink: 0, alignItems: "center", gap: 2 },
  connectionLine: { flexDirection: "row", alignItems: "center", gap: 2 },
  connectionDash: { width: 9, height: 1, backgroundColor: "#a2d6c4" },
  connectionTime: {
    fontSize: 10,
    fontWeight: "600",
    color: theme.colors.inkMuted,
  },
  connectionDate: { fontSize: 9, lineHeight: 12, color: theme.colors.inkMuted },
  journeyActions: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 10,
    paddingBottom: 10,
    zIndex: 1,
  },
  journeyAction: {
    flex: 1,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 16,
    backgroundColor: "rgba(221,243,233,0.85)",
  },
  journeyActionText: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  advanceAction: { backgroundColor: theme.colors.primary },
  nextStatusHint: {
    textAlign: "right",
    paddingHorizontal: 16,
    paddingBottom: 10,
    fontSize: 10,
    color: theme.colors.inkMuted,
  },
  mapTicket: {
    marginHorizontal: 10,
    marginBottom: 10,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: "#d8ebe2",
  },
  summaryMap: { height: 210 },
  mapFacts: { flexDirection: "row", borderTopWidth: 1, borderColor: "#d8ebe2" },
  mapFact: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    minHeight: 38,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  mapFactDivider: { borderLeftWidth: 1, borderColor: "#d8ebe2" },
  mapFactValue: {
    flexShrink: 1,
    fontSize: 10,
    fontWeight: "700",
    color: theme.colors.ink,
  },
  mapEstimate: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingBottom: 8,
    paddingTop: 0,
  },
  estimatePrice: { alignItems: "flex-end", gap: 2 },
  detourText: {
    flexShrink: 1,
    fontSize: 10,
    lineHeight: 14,
    color: "#9a7411",
    backgroundColor: "#fff1bd",
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
    overflow: "hidden",
  },
  estimateText: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "700",
    color: theme.colors.primary,
  },
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
