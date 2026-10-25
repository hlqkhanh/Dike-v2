import { PostRoutePreview } from "@/components/PostRoutePreview";
import { ActivePostResponses } from "@/components/ActivePostResponses";
import { LinearGradient } from "expo-linear-gradient";
import type { RidePostView } from "@dike/api-client-ts";
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
  Badge,
  Button,
  EmptyState,
  Field,
  Icon,
  LoadingCards,
  Text,
  ui,
} from "@/components/ui";
import { useMobileApi, money } from "@/core/hooks";
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
          <View pointerEvents="none" style={styles.heroCurve} />
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
                style={{
                  minHeight: 48,
                  padding: theme.spacing.sm,
                  flexDirection: "row",
                  gap: theme.spacing.sm,
                  alignItems: "center",
                }}
              >
                <Icon name="location-outline" size={20} />
                <Text numberOfLines={1} style={{ flex: 1, fontWeight: "700" }}>
                  {places.preferences.pickup?.displayLabel ??
                    "Chọn điểm đi của bạn"}
                </Text>
                <Icon name="chevron-forward" size={18} />
              </Pressable>
            </Animated.View>
            <View
              style={[
                styles.features,
                { marginTop: Math.max(180, windowHeight * 0.27) },
              ]}
            >
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
          </View>
        </View>
        <View style={styles.content}>
          <ActivePostResponses compact />
          <View style={styles.feedHeading}>
            <Text style={styles.sectionTitle}>Hành trình của bạn</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Lọc ngày khởi hành"
              onPress={() => setShowDate(!showDate)}
              style={styles.dateButton}
            >
              <Icon name="calendar-outline" size={17} color={h.primary} />
              <Text style={styles.dateText}>
                {date || "Lọc ngày khởi hành"}
              </Text>
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
          <View style={styles.filters}>
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
                    styles.filterChip,
                    selected
                      ? styles.filterChipActive
                      : styles.filterChipInactive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selected
                        ? styles.filterChipTextActive
                        : styles.filterChipTextInactive,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
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
            <>
              <View style={ui.row}>
                <Text style={[ui.muted, { flex: 1 }]}>Người cùng đường</Text>
                <Badge label={`${posts.length} bài đăng`} />
              </View>
              {posts.map((p) => (
                <PostCard key={p.id} post={p} viewerId={session?.user.id} />
              ))}
            </>
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

function PostCard({
  post: p,
  viewerId,
}: {
  post: RidePostView;
  viewerId?: string;
}) {
  const passenger = p.type === "NEED_RIDE";
  const own = p.ownerId === viewerId;
  const actionLabel = own
    ? p.pendingResponseCount > 0
      ? "Xem yêu cầu"
      : "Quản lý bài"
    : p.status !== "OPEN"
      ? "Xem bài đăng"
      : passenger
        ? "Xem nhu cầu"
        : "Xem chuyến đi";
  const accent = passenger ? h.passengerInk : h.primary;
  const soft = passenger ? h.passengerSoft : h.primarySoft;
  const departure = new Date(p.departureAt);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${actionLabel}: từ ${p.originLabel} đến ${p.destinationLabel}`}
      onPress={() =>
        router.push({ pathname: "/posts/[id]", params: { id: p.id } })
      }
      style={({ pressed }) => [
        styles.post,
        passenger && styles.passengerPost,
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={styles.postHeader}>
        <Avatar name={p.ownerDisplayName} uri={p.ownerAvatarUrl} size={40} />
        <View style={styles.postIdentity}>
          <Text style={styles.ownerName}>{p.ownerDisplayName}</Text>
          <View style={styles.inline}>
            <Text style={styles.caption}>
              {p.visibility === "PUBLIC"
                ? "Hành trình công khai"
                : "Hành trình cộng đồng"}
            </Text>
            <Icon
              name={
                p.visibility === "PUBLIC" ? "globe-outline" : "people-outline"
              }
              size={14}
              color={h.muted}
            />
          </View>
        </View>
        <View style={[styles.roleBadge, { backgroundColor: soft }]}>
          <Icon name="car-outline" size={16} color={accent} />
          <Text style={[styles.roleText, { color: accent }]}>
            {passenger ? "Tôi đi ké" : "Tôi chở"}
          </Text>
        </View>
      </View>
      <View style={styles.routeRow}>
        <View style={styles.routeRail}>
          <View style={[styles.routeDot, { backgroundColor: accent }]} />
          <View style={[styles.routeLine, { backgroundColor: accent }]} />
          <View style={[styles.routeDot, { backgroundColor: accent }]} />
        </View>
        <View style={styles.routeLabels}>
          <View style={styles.routeStop}>
            <Text style={styles.caption}>Điểm đi</Text>
            <Text style={styles.routeText}>{p.originLabel}</Text>
          </View>
          <View style={styles.routeStop}>
            <Text style={styles.caption}>Điểm đến</Text>
            <Text style={styles.routeText}>{p.destinationLabel}</Text>
          </View>
        </View>
        <PostRoutePreview postId={p.id} />
      </View>
      <View style={styles.metadata}>
        <View style={styles.inline}>
          <Icon name="calendar-outline" size={16} color={h.muted} />
          <Text style={styles.metaText}>
            {departure.toLocaleDateString("vi-VN")}
          </Text>
        </View>
        <View style={styles.inline}>
          <Icon name="time-outline" size={16} color={h.muted} />
          <Text style={styles.metaText}>
            {departure.toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
        <View style={styles.inline}>
          <Icon
            name={p.vehicleType === "CAR" ? "car-outline" : "bicycle-outline"}
            size={18}
            color={h.muted}
          />
          <Text style={styles.metaText}>
            {p.vehicleType === "CAR" ? "Ô tô" : "Xe máy"}
          </Text>
        </View>
      </View>
      {p.note ? (
        <Text numberOfLines={2} style={styles.note}>
          {p.note}
        </Text>
      ) : null}
      <View style={styles.postFooter}>
        <View style={styles.postStats}>
          <View style={[styles.statPill, { backgroundColor: soft }]}>
            <Icon name="car-outline" size={16} color={accent} />
            <Text style={[styles.statText, { color: accent }]}>
              {passenger ? "Cần đi ké" : `Còn ${p.remainingSeats} chỗ`}
            </Text>
          </View>
          <View style={[styles.statPill, { backgroundColor: soft }]}>
            <Icon name="person-outline" size={16} color={accent} />
            <Text style={[styles.statText, { color: accent }]}>
              {p.pendingResponseCount} yêu cầu
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.joinButton,
            {
              backgroundColor: passenger ? h.surface : h.primary,
              borderColor: accent,
            },
          ]}
        >
          <Text
            style={[styles.joinText, { color: passenger ? accent : h.surface }]}
          >
            {actionLabel}
          </Text>
          <Icon
            name="arrow-forward"
            size={18}
            color={passenger ? accent : h.surface}
          />
        </View>
      </View>
      {p.contributionPerKm > 0 ? (
        <Text style={styles.price}>{money(p.contributionPerKm)}/km</Text>
      ) : null}
    </Pressable>
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
  heroCurve: {
    position: "absolute",
    bottom: 0,
    start: 0,
    end: 0,
    height: 32,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: h.surface,
  },
  heroContent: { paddingHorizontal: 20, paddingBottom: 56 },
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
  features: {
    flexDirection: "row",
    gap: 8,
    transform: [{ translateY: 56 }],
    zIndex: 3,
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
    position: "relative",
    paddingTop: 68,
    paddingHorizontal: 20,
    gap: 12,
    zIndex: 2,
  },
  feedHeading: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 22,
    lineHeight: 32,
    fontWeight: "800",
    letterSpacing: -0.6,
    color: h.ink,
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: h.primarySoft,
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 48,
  },
  dateText: { color: h.primary, fontSize: 11, fontWeight: "700" },
  filters: { flexDirection: "row", gap: 8, marginBottom: 4 },
  filterChip: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  filterChipActive: { backgroundColor: h.primary, ...theme.shadow.card },
  filterChipInactive: {
    backgroundColor: h.surface,
    borderWidth: 1,
    borderColor: h.border,
    ...theme.shadow.card,
  },
  filterChipText: { fontSize: 14, fontWeight: "700" },
  filterChipTextActive: { color: h.surface },
  filterChipTextInactive: { color: h.ink },
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
