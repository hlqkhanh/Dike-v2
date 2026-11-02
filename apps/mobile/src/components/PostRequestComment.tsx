import type { RidePostResponse, RidePostView } from "@dike/api-client-ts";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { dateTime, money, statusLabel } from "@/core/hooks";
import { responsePlaces } from "@/core/journey-stops";
import { splitPlaceLabel } from "@/core/place-label";
import { theme } from "@/core/theme";
import { Avatar, Icon, Text } from "./ui";
import { RideProgress } from "./RideProgress";

export function PostRequestComment({
  response: r,
  post,
  own,
  viewerId,
  onDecision,
  selected = false,
  onSelect,
  onChat,
  chatPending = false,
  journey = false,
}: {
  response: RidePostResponse;
  post: RidePostView;
  own: boolean;
  viewerId?: string;
  selected?: boolean;
  onSelect?: () => void;
  onChat?: () => void;
  chatPending?: boolean;
  journey?: boolean;
  onDecision: (response: RidePostResponse, value: string) => void;
}) {
  const requesterPassenger = post.type === "OFFER_RIDE";
  const check = r.pickupCheck;
  const summary = r.requestSummary;
  const places = responsePlaces(post, r);
  const { pickup, dropoff } = places;
  const visibleMessage = journey ? places.message : r.message;
  const different = (label: string | undefined, original: string) =>
    !!label &&
    label.trim().toLocaleLowerCase("vi") !==
      original.trim().toLocaleLowerCase("vi");
  const pickupChanged =
    summary?.pickupChanged ?? different(pickup, post.originLabel);
  const dropoffChanged =
    summary?.dropoffChanged ?? different(dropoff, post.destinationLabel);
  const meters = summary?.extraMeters ?? check?.extraMeters ?? 0;
  const seconds = summary?.extraSeconds ?? check?.extraSeconds ?? 0;
  const amount = summary?.estimatedAmountVnd ?? check?.estimatedAmountVnd;
  const changedPlaces = [
    {
      changed: journey || pickupChanged,
      label: pickup ?? (journey ? post.originLabel : ""),
      color: "#dcb84b",
      id: "pickup",
    },
    {
      changed: journey || dropoffChanged,
      label: dropoff ?? (journey ? post.destinationLabel : ""),
      color: "#79bda6",
      id: "dropoff",
    },
  ].filter((place) => place.changed && place.label);
  return (
    <View
      style={[
        styles.comment,
        selected && styles.selected,
        !own && styles.flatComment,
      ]}
      testID={"request-comment-" + r.id}
    >
      {onSelect ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={"Xem tuyến của " + r.requesterDisplayName}
          accessibilityState={{ selected }}
          onPress={onSelect}
          style={StyleSheet.absoluteFill}
          testID={"select-request-" + r.id}
        />
      ) : null}
      {own ? (
        <View pointerEvents="box-none" style={styles.selectionHeading}>
          <Text style={styles.selectionText}>
            {selected ? "Đang xem tuyến" : ""}
          </Text>
          {selected ? <Icon name="checkmark-circle" size={18} /> : null}
        </View>
      ) : null}
      {own ? (
        <View pointerEvents="none" style={styles.header}>
          <Avatar
            name={r.requesterDisplayName}
            uri={r.requesterAvatarUrl}
            size={36}
          />
          <View style={styles.identity}>
            <Text style={styles.name}>{r.requesterDisplayName}</Text>
            <Text style={styles.status}>{statusLabel(r.status)}</Text>
          </View>
          <Text style={styles.time}>
            {dateTime(check?.pickupAt ?? r.createdAt)}
          </Text>
        </View>
      ) : (
        <View pointerEvents="none" style={styles.summaryHeader}>
          <View style={styles.identity}>
            <Text style={styles.name}>
              {journey ? "Hành trình của bạn" : "Yêu cầu của bạn"}
            </Text>
            <View style={styles.pickupTime}>
              <Icon
                name="time-outline"
                size={13}
                color={theme.colors.inkMuted}
              />
              <Text style={styles.time}>
                {dateTime(check?.pickupAt ?? post.departureAt)}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.statusBadge,
              !own && requesterPassenger && { backgroundColor: "#ffedab" },
              r.status === "REJECTED" && styles.rejectedBadge,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                !own &&
                  requesterPassenger && { color: theme.colors.passengerInk },
                r.status === "REJECTED" && styles.rejectedText,
              ]}
            >
              {statusLabel(r.status)}
            </Text>
          </View>
        </View>
      )}
      {visibleMessage ? (
        <Text pointerEvents="none" style={styles.message}>
          {visibleMessage}
        </Text>
      ) : null}
      {!journey && changedPlaces.length ? (
        <View pointerEvents="none" style={styles.route}>
          {changedPlaces.map((place, index) => (
            <View key={place.id} style={styles.routeRow}>
              <View style={styles.markerColumn} accessible={false}>
                {changedPlaces.length === 2 ? (
                  <View
                    style={[
                      index === 0
                        ? styles.originConnector
                        : styles.destinationConnector,
                      {
                        backgroundColor:
                          index === 0 ? "#dcb84b" : theme.colors.primary,
                      },
                    ]}
                  />
                ) : null}
                <View
                  style={[
                    place.id === "pickup"
                      ? styles.originMarker
                      : styles.destinationMarker,
                    place.id === "pickup"
                      ? { borderColor: "#dcb84b" }
                      : { backgroundColor: theme.colors.primary },
                  ]}
                />
              </View>
              <View
                testID={"request-" + place.id}
                style={[
                  styles.place,
                  { borderColor: place.color },
                  selected && styles.selectedPlace,
                ]}
              >
                <Text style={styles.placeName}>
                  {splitPlaceLabel(place.label).name}
                </Text>
                {splitPlaceLabel(place.label).address ? (
                  <Text style={styles.address}>
                    {splitPlaceLabel(place.label).address}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}
      <View pointerEvents="none" style={styles.badges} testID="request-badges">
        <View style={styles.badge}>
          <Icon
            name="navigate-outline"
            size={13}
            color={theme.colors.inkMuted}
          />
          <Text numberOfLines={1} style={styles.badgeText}>
            +
            {(meters / 1000).toLocaleString("vi-VN", {
              maximumFractionDigits: 2,
            })}{" "}
            km
          </Text>
        </View>
        <View style={styles.badge}>
          <Icon name="time-outline" size={13} color={theme.colors.inkMuted} />
          <Text numberOfLines={1} style={styles.badgeText}>
            +{Math.ceil(seconds / 60)} phút
          </Text>
        </View>
        <View
          style={[
            styles.badge,
            styles.priceBadge,
            requesterPassenger && {
              backgroundColor: theme.colors.passengerSoft,
            },
          ]}
        >
          <Text
            numberOfLines={2}
            style={[
              styles.price,
              requesterPassenger && { color: theme.colors.passengerInk },
            ]}
          >
            {amount != null
              ? "Dự tính " + money(amount)
              : post.type === "NEED_RIDE"
                ? "Thỏa thuận"
                : "Chưa có giá dự tính"}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        {r.status === "PENDING" ? (
          own ? null : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Rút yêu cầu"
              onPress={() => onDecision(r, "WITHDRAWN")}
              style={[styles.action, styles.withdrawAction]}
            >
              <Icon name="close-circle-outline" size={17} color="#c44c45" />
              <Text style={[styles.actionText, styles.withdrawText]}>
                Rút yêu cầu
              </Text>
            </Pressable>
          )
        ) : null}
        {r.conversationId || onChat ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mở trò chuyện"
            disabled={chatPending}
            onPress={() => {
              if (r.conversationId)
                router.push({
                  pathname: "/chat/[id]",
                  params: { id: r.conversationId },
                });
              else onChat?.();
            }}
            style={[
              styles.action,
              !own && {
                backgroundColor: requesterPassenger
                  ? "#f5cf6c"
                  : theme.colors.primary,
              },
              chatPending && { opacity: 0.5 },
            ]}
          >
            {!own ? (
              <Icon name="chatbubble-ellipses-outline" size={17} color="#fff" />
            ) : null}
            <Text style={[styles.actionText, !own && { color: "#fff" }]}>
              Nhắn tin
            </Text>
          </Pressable>
        ) : null}
      </View>
      {["ACCEPTED", "DRIVER_STARTED", "DRIVER_ARRIVED", "COMPLETED"].includes(
        r.status,
      ) ? (
        <RideProgress
          response={r}
          currentUserId={viewerId}
          onAdvance={(value) => onDecision(r, value)}
        />
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  flatComment: {
    borderWidth: 0,
    borderRadius: 0,
    elevation: 0,
    shadowOpacity: 0,
    backgroundColor: "transparent",
    padding: 12,
  },
  withdrawAction: { backgroundColor: "#fff0ee" },
  withdrawText: { color: "#c44c45" },
  summaryHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  pickupTime: { flexDirection: "row", alignItems: "center", gap: 4 },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "#e8f7f1",
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.primary,
  },
  rejectedBadge: { backgroundColor: "#fff0ef" },
  rejectedText: { color: "#b33d36" },
  selected: { borderColor: theme.colors.primary, borderWidth: 2 },
  selectionHeading: {
    position: "absolute",
    right: 10,
    top: 8,
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
  },
  selectionText: { fontSize: 10, color: theme.colors.primary },
  comment: {
    backgroundColor: "#fff",
    shadowColor: "#183e32",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 5,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#e7ece9",
    borderRadius: 14,
    padding: 10,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 12,
  },
  identity: { flex: 1, minWidth: 0, gap: 3 },
  name: { fontSize: 13, fontWeight: "700", color: theme.colors.ink },
  status: { fontSize: 11, color: theme.colors.inkMuted },
  message: { fontSize: 13, lineHeight: 19, color: theme.colors.ink },
  route: { gap: 12 },
  routeRow: { flexDirection: "row", alignItems: "stretch", gap: 8 },
  markerColumn: { width: 16, alignItems: "center", justifyContent: "center" },
  originConnector: {
    position: "absolute",
    width: 2,
    left: 7,
    top: "50%",
    bottom: -6,
    backgroundColor: "#dcb84b",
  },
  destinationConnector: {
    position: "absolute",
    width: 2,
    left: 7,
    top: -6,
    bottom: "50%",
    backgroundColor: "#087d61",
  },
  originMarker: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#dcb84b",
    backgroundColor: "#fff",
  },
  destinationMarker: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#087d61",
  },
  selectedPlace: { borderWidth: 2, borderStyle: "solid" },
  place: {
    flex: 1,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 7,
    gap: 2,
  },
  placeName: { fontSize: 12, fontWeight: "600" },
  address: { fontSize: 11, lineHeight: 16, color: theme.colors.inkMuted },
  badges: { flexDirection: "row", alignItems: "stretch", gap: 6 },
  badge: {
    flex: 1,
    minWidth: 0,
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 5,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: "#f0f3f1",
  },
  badgeText: { fontSize: 11, color: theme.colors.inkMuted, flexShrink: 1 },
  priceBadge: { backgroundColor: "#e8f5ee" },
  price: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.primary,
    textAlign: "center",
  },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  time: { fontSize: 10, color: theme.colors.inkMuted },
  action: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0f3f1",
    paddingHorizontal: 10,
  },
  acceptAction: { backgroundColor: theme.colors.primary },
  acceptText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  actionText: { fontSize: 13, fontWeight: "600", color: theme.colors.ink },
});
