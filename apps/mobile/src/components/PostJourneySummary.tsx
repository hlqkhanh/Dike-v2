import type { RidePostView } from "@dike/api-client-ts";
import { Pressable, StyleSheet, View } from "react-native";
import { money, statusLabel } from "@/core/hooks";
import { splitPlaceLabel } from "@/core/place-label";
import { theme } from "@/core/theme";
import { Avatar, Icon, Text, type IconName } from "./ui";

export function PostJourneySummary({
  post,
  collapsed = false,
}: {
  post: RidePostView;
  collapsed?: boolean;
}) {
  const passenger = post.type === "NEED_RIDE";
  const accent = passenger ? theme.colors.passengerInk : theme.colors.primary;
  const departure = new Date(post.departureAt);
  const places = [
    splitPlaceLabel(post.originLabel),
    splitPlaceLabel(post.destinationLabel),
  ];
  return (
    <View style={styles.summary} testID="post-journey-summary">
      {!collapsed ? (
        <View style={styles.places}>
          {places.map((place, index) => (
            <View key={index} style={styles.placeRow}>
              <View style={styles.rail}>
                <View
                  style={
                    index === 0
                      ? styles.originConnector
                      : styles.destinationConnector
                  }
                />
                <View
                  style={[
                    styles.marker,
                    index === 0 ? styles.origin : styles.destination,
                  ]}
                />
              </View>
              <View
                style={[
                  styles.place,
                  { borderColor: index === 0 ? "#dcb84b" : "#79bda6" },
                ]}
              >
                <Text numberOfLines={2} style={styles.placeName}>
                  {place.name}
                </Text>
                {place.address ? (
                  <Text numberOfLines={1} style={styles.address}>
                    {place.address}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.stats}>
        {[
          {
            icon:
              post.vehicleType === "CAR" ? "car-outline" : "bicycle-outline",
            value: post.vehicleType === "CAR" ? "Ô tô" : "Xe máy",
          },
          {
            icon: "cash-outline",
            value:
              post.contributionPerKm == null
                ? "Thỏa thuận"
                : money(post.contributionPerKm) + "/km",
          },
          {
            icon: "time-outline",
            value:
              departure.toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
              }) +
              " " +
              departure.toLocaleDateString("vi-VN", {
                day: "2-digit",
                month: "2-digit",
              }),
          },
        ].map((item, index) => (
          <View
            key={item.icon}
            style={[styles.stat, index > 0 && styles.divider]}
          >
            <Icon name={item.icon as IconName} size={17} color={accent} />
            <Text
              numberOfLines={index === 2 ? 1 : 2}
              adjustsFontSizeToFit={index === 2}
              minimumFontScale={0.8}
              style={[styles.value, index === 2 && { fontSize: 10 }]}
            >
              {item.value}
            </Text>
          </View>
        ))}
      </View>
      {!collapsed && post.note ? (
        <Text numberOfLines={2} style={styles.note}>
          {post.note}
        </Text>
      ) : null}
    </View>
  );
}
export function PostJourneyHeading({
  post,
  collapsed,
  onToggle,
}: {
  post?: RidePostView;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const passenger = post?.type === "NEED_RIDE";
  const accent = passenger ? theme.colors.passengerInk : theme.colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        collapsed
          ? "Mở rộng thông tin chuyến đi"
          : "Thu gọn thông tin chuyến đi"
      }
      aria-expanded={!collapsed}
      onPress={onToggle}
      style={styles.heading}
      testID="post-summary-toggle"
    >
      <Avatar
        userId={post?.ownerId}
        name={post?.ownerDisplayName}
        uri={post?.ownerAvatarUrl}
        size={28}
      />
      <View style={styles.identity}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
          userId={post?.ownerId}
          style={styles.ownerName}
        >
          {post?.ownerDisplayName ?? "..."}
        </Text>
        <View
          style={[
            styles.badge,
            styles.roleBadge,
            {
              backgroundColor: passenger
                ? theme.colors.passengerSoft
                : "#eaf7f0",
            },
          ]}
        >
          <Icon
            name={passenger ? "person-outline" : "car-outline"}
            size={11}
            color={accent}
          />
          <Text style={[styles.roleText, { color: accent }]}>
            {passenger ? "Tôi đi ké" : "Tôi chở"}
          </Text>
        </View>
      </View>
      <View style={[styles.badge, styles.status]}>
        <View
          style={[
            styles.dot,
            {
              backgroundColor: post?.status === "OPEN" ? "#20bc75" : "#91a39a",
            },
          ]}
        />
        <Text numberOfLines={1} style={styles.statusText}>
          {statusLabel(post?.status ?? "")}
        </Text>
      </View>

      <Icon
        name={collapsed ? "chevron-down" : "chevron-up"}
        size={15}
        color={theme.colors.inkMuted}
      />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  summary: { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  places: { gap: 9 },
  placeRow: { flexDirection: "row", gap: 8, alignItems: "stretch" },
  rail: { width: 14, alignItems: "center", justifyContent: "center" },
  originConnector: {
    position: "absolute",
    width: 2,
    top: "50%",
    bottom: -4.5,
    backgroundColor: "#dcb84b",
  },
  destinationConnector: {
    position: "absolute",
    width: 2,
    top: -4.5,
    bottom: "50%",
    backgroundColor: theme.colors.primary,
  },
  marker: { width: 9, height: 9, borderRadius: 5 },
  origin: { backgroundColor: "#fff", borderWidth: 2, borderColor: "#dfb83f" },
  destination: { backgroundColor: theme.colors.primary },
  place: {
    flex: 1,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 6,
    gap: 2,
  },
  placeName: { fontSize: 12, fontWeight: "600", lineHeight: 17 },
  address: { fontSize: 10, color: theme.colors.inkMuted, lineHeight: 14 },
  heading: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 6,
  },
  identity: { flex: 1, minWidth: 0, gap: 3 },
  badge: {
    width: 70,
    height: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  roleBadge: { alignSelf: "flex-start" },
  roleText: { fontSize: 9, lineHeight: 12, fontWeight: "700" },
  ownerName: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.ink,
  },
  status: { backgroundColor: "#eaf7f0" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  stats: {
    flexDirection: "row",
    paddingTop: 9,
    borderTopWidth: 1,
    borderColor: "#edf1ee",
  },
  stat: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 4,
    minHeight: 28,
  },
  divider: { borderLeftWidth: 1, borderColor: "#edf1ee" },
  value: { fontSize: 11, fontWeight: "700", flexShrink: 1 },
  note: { fontSize: 11, lineHeight: 16, color: theme.colors.inkMuted },
  request: {
    minHeight: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
  },
  requestText: { color: "#fff", fontWeight: "700", fontSize: 12 },
});
