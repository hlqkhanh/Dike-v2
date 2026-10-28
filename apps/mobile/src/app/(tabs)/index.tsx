import { RidePostCard } from "@/components/RidePostCard";
import { ActivePostResponses } from "@/components/ActivePostResponses";
import { LinearGradient } from "expo-linear-gradient";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { usePlaces } from "@/core/places";
import { useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  View,
  TextInput,
  RefreshControl,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { homeAssets } from "@/core/assets";
import { homeTheme as h } from "@/core/home-theme";
import { theme } from "@/core/theme";
import {
  Avatar,
  Button,
  EmptyState,
  Field,
  Icon,
  LoadingCards,
  Text,
} from "@/components/ui";
import { useMobileApi } from "@/core/hooks";
import { useSession } from "@/core/session";
export default function Discover() {
  const places = usePlaces();
  const api = useMobileApi();
  const client = useQueryClient();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { session } = useSession();
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [showDate, setShowDate] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const pinDistance = Math.max(320, windowHeight * 0.55);
  const pinnedTranslateY = scrollY.interpolate({
    inputRange: [0, pinDistance],
    outputRange: [0, pinDistance],
    extrapolate: "clamp",
  });
  const query = useInfiniteQuery({
    queryKey: ["mobile-feed"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.feed(pageParam),
    getNextPageParam: (last) => last.nextCursor || undefined,
  });
  const posts = useMemo(
    () =>
      query.data?.pages
        .flatMap((p) => p.items)
        .filter((p, i, a) => a.findIndex((x) => x.id === p.id) === i)
        .filter(
          (p) =>
            (filter === "ALL" || p.type === filter) &&
            `${p.originLabel} ${p.destinationLabel} ${p.ownerDisplayName}`
              .toLocaleLowerCase("vi")
              .includes(search.toLocaleLowerCase("vi")) &&
            (!date ||
              new Date(p.departureAt)
                .toLocaleDateString("vi-VN")
                .includes(date)),
        ) ?? [],
    [query.data, filter, search, date],
  );
  if (places.isSuccess && !places.preferences.configured)
    return <Redirect href="/onboarding/location" />;
  return (
    <View style={styles.page}>
      <Animated.ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 130 + insets.bottom }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching && !query.isFetchingNextPage}
            onRefresh={() => {
              void query.refetch();
              void client.invalidateQueries({
                queryKey: ["mobile-active-responses"],
              });
            }}
            tintColor={h.primary}
          />
        }
      >
        <View style={styles.hero}>
          <Animated.Image
            source={homeAssets.homeBanner}
            resizeMode="cover"
            style={[
              styles.heroImage,
              { transform: [{ translateY: pinnedTranslateY }] },
            ]}
          />
          <View style={[styles.heroContent, { paddingTop: insets.top + 14 }]}>
            <Animated.View
              style={[
                styles.pinnedHeader,
                { transform: [{ translateY: pinnedTranslateY }] },
              ]}
            >
              <View style={styles.brandRow}>
                <Image
                  source={homeAssets.logo}
                  accessibilityLabel="Logo Diké"
                  resizeMode="contain"
                  style={styles.logo}
                />
                <Text style={styles.brand}>Diké</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Thông báo"
                  onPress={() => router.push("/notifications")}
                  style={styles.bell}
                >
                  <View style={styles.bellSurface}>
                    <Icon
                      name="notifications-outline"
                      size={21}
                      color={h.ink}
                    />
                  </View>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Mở trang cá nhân"
                  onPress={() => router.push("/(tabs)/profile")}
                  style={styles.profileButton}
                >
                  <Avatar
                    name={session?.user.displayName}
                    uri={session?.user.avatarUrl}
                    size={34}
                  />
                </Pressable>
              </View>
              <View style={styles.search}>
                <View pointerEvents="none" style={styles.searchGlass}>
                  <LinearGradient
                    colors={[
                      "rgba(255,255,255,0.48)",
                      "rgba(232,249,242,0.16)",
                      "rgba(255,255,255,0.32)",
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                </View>
                <Icon name="search-outline" size={25} color={h.routeInk} />
                <TextInput
                  accessibilityLabel="Tìm hành trình"
                  placeholder="Bạn muốn đi đâu, ăn gì?"
                  placeholderTextColor={h.muted}
                  value={search}
                  onChangeText={setSearch}
                  style={styles.searchInput}
                  returnKeyType="search"
                />
                <View style={styles.searchEnd}>
                  <Icon name="location-outline" size={23} color={h.surface} />
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Thay đổi điểm đi mặc định"
                onPress={() => router.push("/onboarding/location")}
                style={styles.locationBar}
              >
                <Icon name="location-outline" size={20} color={h.primary} />
                <Text numberOfLines={1} style={styles.locationText}>
                  {places.preferences.pickup?.displayLabel ??
                    "Chọn điểm đi của bạn"}
                </Text>
                <Icon name="chevron-forward" size={18} color={h.muted} />
              </Pressable>
            </Animated.View>
            <View
              style={{
                height: Math.max(260, windowHeight * 0.38),
              }}
            />
          </View>
        </View>
        <View style={styles.content}>
          <View style={styles.features}>
            <FeatureCard
              driver
              onPress={() =>
                router.push({
                  pathname: "/create-trip",
                  params: { mode: "driver" },
                })
              }
            />
            <FeatureCard
              onPress={() =>
                router.push({
                  pathname: "/create-trip",
                  params: { mode: "passenger" },
                })
              }
            />
          </View>
          <View style={styles.filterBar}>
            {/* 3 bộ lọc gọn gàng dạng segmented control */}
            <View style={styles.segmentedControl}>
              {[
                ["ALL", "Tất cả"],
                ["OFFER_RIDE", "Tôi chở"],
                ["NEED_RIDE", "Tôi đi ké"],
              ].map(([value, label]) => {
                const selected = filter === value;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={label}
                    onPress={() => setFilter(value)}
                    style={[
                      styles.segmentPill,
                      selected && styles.segmentPillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        selected && styles.segmentTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Nút lọc ngày khởi hành ngang hàng */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Lọc ngày khởi hành"
              onPress={() => setShowDate(!showDate)}
              style={[
                styles.dateButton,
                Boolean(date) && styles.dateButtonActive,
              ]}
            >
              <Icon
                name="calendar-outline"
                size={15}
                color={date ? "#0d8a68" : "#475569"}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.dateText,
                  Boolean(date) && styles.dateTextActive,
                ]}
              >
                {date || "Lọc ngày"}
              </Text>
              {date ? (
                <Pressable
                  hitSlop={8}
                  onPress={(e) => {
                    e.stopPropagation();
                    setDate("");
                  }}
                >
                  <Icon name="close-circle" size={15} color="#0d8a68" />
                </Pressable>
              ) : null}
            </Pressable>
          </View>
          {showDate ? (
            <Field
              label="Ngày khởi hành"
              value={date}
              onChangeText={setDate}
              placeholder="Ví dụ 19/10/2026, xóa để bỏ lọc"
              keyboardType="numbers-and-punctuation"
            />
          ) : null}
          {query.isLoading ? (
            <LoadingCards />
          ) : query.isError ? (
            <EmptyState
              title="Chưa tải được hành trình"
              icon="cloud-offline-outline"
              description="Kiểm tra kết nối và thử lại."
              onRetry={() => void query.refetch()}
            />
          ) : posts.length === 0 ? (
            <View style={styles.emptyCard}>
              <Image
                source={homeAssets.journey}
                resizeMode="contain"
                style={styles.emptyArt}
              />
              <Text style={styles.emptyTitle}>Chưa có chuyến phù hợp</Text>
              <Text style={styles.emptyDescription}>
                Thử thay đổi bộ lọc hoặc tạo hành trình của bạn.
              </Text>
            </View>
          ) : (
            posts.map((p) => (
              <RidePostCard key={p.id} post={p} viewerId={session?.user.id} onChanged={() => void query.refetch()} />
            ))
          )}
          {query.hasNextPage ? (
            <Button
              label="Xem thêm hành trình"
              variant="secondary"
              pending={query.isFetchingNextPage}
              onPress={() => void query.fetchNextPage()}
            />
          ) : null}
        </View>
      </Animated.ScrollView>
      <ActivePostResponses floating bottomOffset={84 + insets.bottom} />
    </View>
  );
}

function FeatureCard({
  driver = false,
  onPress,
}: {
  driver?: boolean;
  onPress: () => void;
}) {
  const color = driver ? h.surface : h.ink;
  return (
    <View style={styles.featureShell}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          driver
            ? "Tôi chở · Đăng chuyến đi chung"
            : "Tôi đi ké · Tìm chuyến phù hợp"
        }
        onPress={onPress}
        style={({ pressed }) => [
          styles.feature,
          {
            backgroundColor: driver ? h.primary : h.passengerSoft,
            opacity: pressed ? 0.92 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
      >
        <LinearGradient
          colors={
            driver
              ? [h.driverStart, h.driverScrim, h.clear]
              : [h.passengerSoft, h.passengerScrim, h.clear]
          }
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />
        <Image
          source={driver ? homeAssets.driver : homeAssets.passenger}
          resizeMode="cover"
          style={styles.featureArt}
        />
        <View style={styles.featureContent}>
          <View style={styles.featureLabel}>
            <Text style={[styles.featureTitle, { color }]}>
              {driver ? "Tôi chở" : "Tôi đi ké"}
            </Text>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: h.surface },
  hero: { width: "100%", position: "relative", zIndex: 1 },
  heroImage: {
    position: "absolute",
    top: 0,
    start: 0,
    width: "100%",
    height: "100%",
  },
  heroContent: { paddingHorizontal: 16, paddingBottom: 0 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  logo: { width: 36, height: 36 },
  brand: { fontSize: 23, fontWeight: "800", color: h.ink },
  bell: {
    marginStart: "auto",
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  bellSurface: {
    width: 38,
    height: 38,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: h.glass,
  },
  profileButton: {
    minHeight: 48,
    minWidth: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  pinnedHeader: { position: "relative", zIndex: 2 },
  search: {
    marginTop: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(238,250,244,0.12)",
    borderColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderRadius: 40,
    minHeight: 52,
    overflow: "hidden",
    paddingStart: 16,
    paddingEnd: 4,
    ...theme.shadow.card,
  },
  searchGlass: {
    ...StyleSheet.absoluteFill,
    borderRadius: 40,
    overflow: "hidden",
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: theme.font.regular,
    color: h.ink,
    fontSize: 13,
    minHeight: 50,
    paddingVertical: 12,
    zIndex: 1,
  },
  searchEnd: {
    borderRadius: 28,
    width: 44,
    height: 44,
    backgroundColor: h.primary,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  locationBar: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
    borderRadius: 20,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.85)",
  },
  locationText: {
    flex: 1,
    fontWeight: "700",
    fontSize: 13,
    color: h.ink,
  },
  features: {
    flexDirection: "row",
    gap: 10,
    marginTop: -48,
    zIndex: 10,
    elevation: 10,
  },
  feature: {
    flex: 1,
    minHeight: 94,
    borderRadius: 22,
    overflow: "hidden",
  },
  featureShell: {
    backgroundColor: h.surface,
    borderRadius: 22,
    elevation: 9,
    flex: 1,
    shadowColor: "#063b2f",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  featureContent: { flex: 1, position: "relative", zIndex: 2, padding: 14 },
  featureLabel: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureTitle: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  featureArt: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
    transform: [{ translateY: 4 }],
  },
  content: {
    backgroundColor: h.surface,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    marginTop: -48,
    position: "relative",
    paddingTop: 0,
    paddingHorizontal: 16,
    gap: 12,
    zIndex: 2,
    overflow: "visible",
  },
  filterBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 2,
    marginBottom: 2,
  },
  segmentedControl: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 22,
    padding: 3,
  },
  segmentPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentPillActive: {
    backgroundColor: "#0d8a68",
    ...theme.shadow.card,
  },
  segmentText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#64748b",
  },
  segmentTextActive: {
    color: "#ffffff",
    fontWeight: "800",
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 7,
    minHeight: 38,
  },
  dateButtonActive: {
    backgroundColor: "#e8f5ee",
    borderColor: "#0d8a68",
  },
  dateText: { color: "#475569", fontSize: 12, fontWeight: "600" },
  dateTextActive: { color: "#0d8a68", fontWeight: "700" },
  emptyCard: {
    borderRadius: 24,
    padding: 24,
    alignItems: "stretch",
    backgroundColor: h.surface,
    borderWidth: 1,
    borderColor: h.border,
    ...theme.shadow.card,
  },
  emptyArt: { width: "100%", height: 156, marginBottom: 8 },
  emptyTitle: {
    textAlign: "center",
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
    color: h.ink,
    marginBottom: 8,
  },
  emptyDescription: {
    textAlign: "center",
    color: h.muted,
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 24,
  },
  post: {
    padding: 12,
    borderRadius: 20,
    backgroundColor: h.surface,
    borderWidth: 1,
    borderColor: h.border,
    gap: 12,
    ...theme.shadow.card,
  },
  passengerPost: { backgroundColor: h.passengerCanvas },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  postIdentity: { flex: 1, minWidth: 120, gap: 4 },
  ownerName: { fontSize: 15, fontWeight: "700", color: h.ink },
  caption: { fontSize: 11, color: h.muted },
  inline: { flexDirection: "row", alignItems: "center", gap: 4 },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 20,
  },
  roleText: { fontSize: 11, fontWeight: "700" },
  routeRow: { flexDirection: "row", gap: 12, paddingHorizontal: 4 },
  routeRail: { width: 12, alignItems: "center", paddingVertical: 4 },
  routeDot: { width: 10, height: 10, borderRadius: 5 },
  routeLine: { flex: 1, width: 1, minHeight: 32, marginVertical: 4 },
  routeLabels: { flex: 1, gap: 12 },
  routeStop: { gap: 4 },
  routeText: {
    fontSize: 12,
    lineHeight: 20,
    fontWeight: "600",
    color: h.routeInk,
  },
  metadata: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  metaText: { fontSize: 11, color: h.muted },
  note: { fontSize: 12, lineHeight: 20, color: h.muted },
  postFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "space-between",
  },
  postStats: { flex: 1, flexDirection: "row", gap: 4 },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statText: { fontSize: 10, fontWeight: "600" },
  joinButton: {
    flexShrink: 0,
    minHeight: 48,
    borderRadius: 24,
    paddingHorizontal: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  joinText: { fontSize: 12, fontWeight: "700" },
  price: { fontSize: 10, color: h.muted, textAlign: "auto" },
});
