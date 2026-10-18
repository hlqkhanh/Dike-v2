import type { RidePostView } from "@dike/api-client-ts";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { router } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { ImageStyle } from "react-native";

import { Screen, sharedStyles } from "@/components/Screen";
import { createMobileApi } from "@/core/api";
import { useSession } from "@/core/session";
import { theme } from "@/core/theme";

type Filter = "ALL" | "OFFER_RIDE" | "NEED_RIDE";

export default function Discover() {
  const { session, token } = useSession();
  const [filter, setFilter] = useState<Filter>("ALL");
  const query = useQuery({
    queryKey: ["mobile-feed"],
    queryFn: () => createMobileApi(() => Promise.resolve(token)).feed(),
    refetchInterval: 15_000,
  });
  const posts = useMemo(
    () =>
      (query.data?.items ?? []).filter(
        (post) => filter === "ALL" || post.type === filter,
      ),
    [filter, query.data?.items],
  );

  return (
    <Screen
      loading={query.isLoading}
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching}
      subtitle="Những chuyến đi đang chờ bạn"
      title="Bảng feed"
    >
      <View style={styles.filters}>
        {(
          [
            ["ALL", "Tất cả"],
            ["OFFER_RIDE", "Tôi đi ké"],
            ["NEED_RIDE", "Tôi chở"],
          ] as const
        ).map(([value, label]) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            onPress={() => setFilter(value)}
            style={[styles.filter, filter === value && styles.filterActive]}
          >
            <Text
              style={[
                styles.filterText,
                filter === value && styles.filterTextActive,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        onPress={() => router.push("/create-trip")}
        style={styles.createButton}
      >
        <Text style={styles.createButtonText}>＋ Tạo chuyến đi</Text>
      </Pressable>
      {query.isError ? (
        <Text accessibilityRole="alert" style={sharedStyles.empty}>
          Không tải được bảng feed. Kéo xuống để thử lại.
        </Text>
      ) : null}
      {!query.isError && posts.length === 0 ? (
        <Text style={sharedStyles.empty}>Chưa có chuyến đi phù hợp.</Text>
      ) : null}
      {posts.map((post) => (
        <RideCard key={post.id} currentUserId={session?.user.id} post={post} />
      ))}
    </Screen>
  );
}

function RideCard({
  currentUserId,
  post,
}: {
  currentUserId?: string;
  post: RidePostView;
}) {
  const passenger = post.type === "NEED_RIDE";
  const departure = new Date(post.departureAt);
  const initials = post.ownerDisplayName
    .split(/\s+/u)
    .map((part) => part[0])
    .join("")
    .slice(-2)
    .toUpperCase();
  return (
    <Pressable
      accessibilityHint="Mở chi tiết bài đăng"
      accessibilityRole="button"
      onPress={() =>
        router.push({ pathname: "/posts/[id]", params: { id: post.id } })
      }
      style={({ pressed }) => [
        styles.card,
        passenger && styles.passengerCard,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.authorRow}>
        {post.ownerAvatarUrl ? (
          <Image
            source={{ uri: post.ownerAvatarUrl }}
            style={styles.avatar as ImageStyle}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarText}>{initials || "DK"}</Text>
          </View>
        )}
        <View style={styles.authorCopy}>
          <Text numberOfLines={1} style={styles.authorName}>
            {post.ownerDisplayName}
          </Text>
          <Text style={styles.meta}>Hành trình công khai</Text>
        </View>
        <View style={[styles.role, passenger && styles.passengerRole]}>
          <Text
            style={[styles.roleText, passenger && styles.passengerRoleText]}
          >
            {passenger ? "Tôi đi ké" : "Tôi chở"}
          </Text>
        </View>
      </View>

      <View style={styles.route}>
        <View style={styles.routeRail}>
          <View style={styles.originDot} />
          <View style={styles.railLine} />
          <View
            style={[styles.destinationDot, passenger && styles.passengerDot]}
          />
        </View>
        <View style={styles.routeCopy}>
          <Text style={styles.routeLabel}>Điểm đón</Text>
          <Text style={styles.routeValue}>{post.originLabel}</Text>
          <Text style={[styles.routeLabel, styles.destinationLabel]}>
            Điểm đến
          </Text>
          <Text style={styles.routeValue}>{post.destinationLabel}</Text>
        </View>
      </View>

      <View style={styles.tripMeta}>
        <Text style={styles.meta}>
          ▣ {departure.toLocaleDateString("vi-VN")}
        </Text>
        <Text style={styles.meta}>
          ◷{" "}
          {departure.toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
        <Text style={styles.meta}>
          {post.vehicleType === "CAR" ? "▰ Ô tô" : "▰ Xe máy"}
        </Text>
      </View>
      {post.note ? (
        <Text numberOfLines={2} style={styles.note}>
          {post.note}
        </Text>
      ) : null}
      <View style={styles.cardFooter}>
        <View style={styles.capacityPill}>
          <Text style={styles.capacityText}>
            ♙ Còn {post.remainingSeats} chỗ
          </Text>
        </View>
        {post.ownerId === currentUserId ? (
          <View style={styles.requestPill}>
            <Text style={styles.requestText}>
              {post.pendingResponseCount} yêu cầu
            </Text>
          </View>
        ) : (
          <View style={[styles.action, passenger && styles.passengerAction]}>
            <Text style={styles.actionText}>
              {passenger ? "Chở ngay" : "Đi ké ngay"} →
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: "row", gap: 8, marginBottom: 2 },
  createButton: {
    alignItems: "center",
    alignSelf: "flex-end",
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  createButtonText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  filter: {
    backgroundColor: "#fff",
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
  filterActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterText: { color: theme.colors.inkMuted, fontSize: 13, fontWeight: "700" },
  filterTextActive: { color: "#fff" },
  card: {
    ...theme.shadow.card,
    backgroundColor: "#fff",
    borderColor: "#bfe2d5",
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  passengerCard: { backgroundColor: "#fffcf4", borderColor: "#efd68e" },
  cardPressed: { opacity: 0.88, transform: [{ scale: 0.995 }] },
  authorRow: { alignItems: "center", flexDirection: "row" },
  avatar: { borderRadius: 24, height: 48, width: 48 },
  avatarFallback: {
    alignItems: "center",
    backgroundColor: "#ddf4eb",
    justifyContent: "center",
  },
  avatarText: { color: theme.colors.primary, fontSize: 16, fontWeight: "900" },
  authorCopy: { flex: 1, marginLeft: 11 },
  authorName: { color: theme.colors.ink, fontSize: 16, fontWeight: "800" },
  meta: { color: "#70877f", fontSize: 12 },
  role: {
    backgroundColor: "#ddf5ed",
    borderRadius: theme.radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  passengerRole: { backgroundColor: "#fff0bd" },
  roleText: { color: "#08785d", fontSize: 12, fontWeight: "800" },
  passengerRoleText: { color: "#876419" },
  route: { flexDirection: "row" },
  routeRail: { alignItems: "center", marginRight: 12, width: 12 },
  originDot: {
    backgroundColor: "#fff",
    borderColor: "#07956e",
    borderRadius: 6,
    borderWidth: 2,
    height: 11,
    width: 11,
  },
  railLine: {
    backgroundColor: "#9fd8c6",
    flex: 1,
    marginVertical: 2,
    width: 1,
  },
  destinationDot: {
    backgroundColor: "#07956e",
    borderRadius: 6,
    height: 11,
    width: 11,
  },
  passengerDot: { backgroundColor: "#e9bd52" },
  routeCopy: { flex: 1 },
  routeLabel: { color: "#8a9b96", fontSize: 11, marginBottom: 2 },
  destinationLabel: { marginTop: 10 },
  routeValue: {
    color: "#173f35",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19,
  },
  tripMeta: {
    borderTopColor: "#e5efeb",
    borderTopWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    paddingTop: 12,
  },
  note: { color: "#60776f", fontSize: 13, lineHeight: 19 },
  cardFooter: { alignItems: "center", flexDirection: "row", gap: 8 },
  capacityPill: {
    backgroundColor: "#e8f6f1",
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  capacityText: { color: "#266a58", fontSize: 12, fontWeight: "800" },
  requestPill: {
    backgroundColor: "#e8f6f1",
    borderRadius: theme.radius.pill,
    marginLeft: "auto",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  requestText: { color: theme.colors.primary, fontSize: 12, fontWeight: "800" },
  action: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.pill,
    marginLeft: "auto",
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  passengerAction: { backgroundColor: "#e9bd52" },
  actionText: { color: "#fff", fontSize: 13, fontWeight: "900" },
});
