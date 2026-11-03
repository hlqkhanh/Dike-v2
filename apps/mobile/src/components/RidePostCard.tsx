import { useState, type PropsWithChildren, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { randomUUID } from "expo-crypto";
import { useMutation } from "@tanstack/react-query";
import type { RidePostView } from "@dike/api-client-ts";
import { dateTime, money, statusLabel, useMobileApi } from "@/core/hooks";
import { theme } from "@/core/theme";
import { splitPlaceLabel } from "@/core/place-label";
import { Avatar, BottomSheet, Button, ErrorText, Icon, Text } from "./ui";
import { PostRoutePreview } from "./PostRoutePreview";
import { ReportSheet } from "./ReportSheet";

export function RidePostFeed({
  children,
  inset = 16,
}: PropsWithChildren<{ inset?: number }>) {
  return (
    <View style={[styles.feed, { marginHorizontal: -inset }]}>{children}</View>
  );
}

export function RidePostCard({
  post,
  viewerId,
  onChanged,
  fullWidth = false,
  detailed = false,
  routePreview,
  routeFields,
  onMenu,
  statusText,
}: {
  post: RidePostView;
  viewerId?: string;
  onChanged?: () => void;
  fullWidth?: boolean;
  detailed?: boolean;
  routePreview?: ReactNode;
  routeFields?: ReactNode;
  onMenu?: () => void;
  statusText?: string;
}) {
  const api = useMobileApi();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const passenger = post.type === "NEED_RIDE";
  const own = post.ownerId === viewerId;
  const accent = passenger ? theme.colors.passenger : theme.colors.primary;
  const soft = passenger ? theme.colors.passengerSoft : "#e8f7f1";
  const accentInk = passenger
    ? theme.colors.passengerInk
    : theme.colors.primary;
  const accentBorder = passenger ? "#efe1b9" : theme.colors.border;
  const remove = useMutation({
    mutationFn: () =>
      api.call(
        `/ride-posts/${encodeURIComponent(post.id)}/close`,
        "POST",
        { version: post.version },
        randomUUID(),
      ),
    onSuccess: () => {
      setConfirmDelete(false);
      onChanged?.();
    },
  });
  const openPost = () =>
    router.push({ pathname: "/posts/[id]", params: { id: post.id } });

  const requestNow = () =>
    router.push({
      pathname: "/posts/[id]",
      params: { id: post.id, action: "request" },
    });

  return (
    <>
      <Pressable
        accessibilityRole={detailed ? undefined : "link"}
        accessibilityLabel={`Xem chuyến từ ${post.originLabel} đến ${post.destinationLabel}`}
        onPress={detailed ? undefined : openPost}
        testID="ride-post-card"
        style={({ pressed }) => [
          styles.card,
          fullWidth && styles.fullWidth,
          detailed && styles.detailCard,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.header}>
          <Avatar
            userId={post.ownerId}
            name={post.ownerDisplayName}
            uri={post.ownerAvatarUrl}
            size={40}
          />
          <View style={styles.identity}>
            <Text
              numberOfLines={1}
              style={styles.ownerName}
              userId={post.ownerId}
            >
              {post.ownerDisplayName}
            </Text>
            <View style={[styles.roleBadge, { backgroundColor: soft }]}>
              <Icon
                name={passenger ? "person-outline" : "car-outline"}
                size={14}
                color={passenger ? theme.colors.passengerInk : accent}
              />
              <Text
                style={[
                  styles.roleText,
                  { color: passenger ? theme.colors.passengerInk : accent },
                ]}
              >
                {passenger ? "Tôi đi ké" : "Tôi chở"}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mở tùy chọn bài đăng"
            onPress={(event) => {
              event.stopPropagation();
              if (onMenu) onMenu();
              else setMenuOpen(true);
            }}
            style={({ pressed }) => [
              styles.moreButton,
              pressed && styles.pressed,
            ]}
          >
            <Icon
              name="ellipsis-horizontal"
              size={22}
              color={theme.colors.inkMuted}
            />
          </Pressable>
        </View>

        {routeFields ?? (
          <View style={styles.route}>
            <View style={styles.routeRow}>
              <View style={styles.markerColumn} accessible={false}>
                <View style={styles.originConnector} />
                <View style={styles.originMarker} />
              </View>
              <View
                style={[styles.addressField, styles.originField]}
                testID="post-origin"
              >
                <View style={styles.addressCopy}>
                  <Text
                    numberOfLines={detailed ? undefined : 2}
                    style={styles.stopText}
                  >
                    {splitPlaceLabel(post.originLabel).name}
                  </Text>
                  {detailed && splitPlaceLabel(post.originLabel).address ? (
                    <Text style={styles.addressDetail}>
                      {splitPlaceLabel(post.originLabel).address}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
            <View style={styles.routeRow}>
              <View style={styles.markerColumn} accessible={false}>
                <View style={styles.destinationConnector} />
                <View style={styles.destinationMarker} />
              </View>
              <View
                style={[
                  styles.addressField,
                  styles.destinationField,
                  !detailed && passenger && { borderColor: "#dcb84b" },
                ]}
                testID="post-destination"
              >
                <View style={styles.addressCopy}>
                  <Text
                    numberOfLines={detailed ? undefined : 2}
                    style={styles.stopText}
                  >
                    {splitPlaceLabel(post.destinationLabel).name}
                  </Text>
                  {detailed &&
                  splitPlaceLabel(post.destinationLabel).address ? (
                    <Text style={styles.addressDetail}>
                      {splitPlaceLabel(post.destinationLabel).address}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          </View>
        )}

        <View style={[styles.mapPanel, { borderColor: accentBorder }]}>
          {routePreview ?? (
            <PostRoutePreview
              postId={post.id}
              style={styles.map}
              passenger={passenger}
            />
          )}
          <View
            style={[styles.summary, { borderTopColor: accentBorder }]}
            testID="post-summary"
          >
            {[
              {
                icon: "time-outline",
                label: "Khởi hành",
                value: dateTime(post.departureAt),
              },
              {
                icon: "cash-outline",
                label: "Đóng góp",
                value:
                  post.contributionPerKm == null
                    ? "Thỏa thuận"
                    : money(post.contributionPerKm) + "/km",
              },
              {
                icon:
                  post.vehicleType === "CAR"
                    ? "car-outline"
                    : "bicycle-outline",
                label: "Phương tiện",
                value: post.vehicleType === "CAR" ? "Ô tô" : "Xe máy",
              },
            ].map((item, index) => (
              <View
                key={item.label}
                style={[
                  styles.summaryItem,
                  index > 0 && [
                    styles.summaryDivider,
                    { borderLeftColor: accentBorder },
                  ],
                ]}
              >
                <Icon
                  name={
                    item.icon as
                      | "time-outline"
                      | "cash-outline"
                      | "car-outline"
                      | "bicycle-outline"
                  }
                  size={18}
                  color={accentInk}
                />
                <Text numberOfLines={2} style={styles.summaryValue}>
                  {item.value}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {detailed ? (
          <View style={styles.detailsMeta}>
            <Text style={styles.addressDetail}>{post.remainingSeats} chỗ</Text>
            <Text style={styles.addressDetail}>
              {statusText ?? statusLabel(post.status)}
            </Text>
          </View>
        ) : null}
        {post.note ? (
          <Text numberOfLines={detailed ? undefined : 2} style={styles.note}>
            {post.note}
          </Text>
        ) : null}
        {!detailed ? (
          <View style={styles.footer}>
            {!own && ["DRAFT", "OPEN"].includes(post.status) ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Yêu cầu ngay"
                onPress={(event) => {
                  event.stopPropagation();
                  requestNow();
                }}
                style={({ pressed }) => [
                  styles.requestButton,
                  { backgroundColor: passenger ? "#f5cf6c" : accent },
                  pressed && styles.pressed,
                ]}
              >
                <Icon name="paper-plane-outline" size={16} color="#fff" />
                <Text style={[styles.requestText]}>Yêu cầu ngay</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Xem chi tiết"
              onPress={(event) => {
                event.stopPropagation();
                openPost();
              }}
              style={({ pressed }) => [
                styles.detailsButton,
                passenger && { backgroundColor: theme.colors.passengerSoft },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.detailsText, { color: accentInk }]}>
                Xem chi tiết
              </Text>
              <Icon name="arrow-forward" size={16} color={accentInk} />
            </Pressable>
          </View>
        ) : null}
      </Pressable>

      <BottomSheet
        visible={menuOpen}
        title="Tùy chọn bài đăng"
        onClose={() => setMenuOpen(false)}
      >
        {!detailed ? (
          <Button
            label={own ? "Quản lý bài đăng" : "Xem bài đăng"}
            icon={own ? "create-outline" : "eye-outline"}
            variant="secondary"
            onPress={() => {
              setMenuOpen(false);
              openPost();
            }}
          />
        ) : null}
        {own && post.status === "OPEN" ? (
          <Button
            label="Đóng bài đăng"
            icon="trash-outline"
            variant="danger"
            onPress={() => {
              setMenuOpen(false);
              setConfirmDelete(true);
            }}
          />
        ) : null}
        {!own ? (
          <Button
            label="Báo cáo bài đăng"
            icon="flag-outline"
            variant="secondary"
            onPress={() => {
              setMenuOpen(false);
              setReportOpen(true);
            }}
          />
        ) : null}
      </BottomSheet>

      <BottomSheet
        visible={confirmDelete}
        title="Đóng bài đăng?"
        onClose={() => setConfirmDelete(false)}
      >
        <Text style={styles.deleteHint}>
          Bài đăng sẽ được đóng, ngừng nhận yêu cầu mới và không còn xuất hiện
          trong danh sách hiện tại.
        </Text>
        <ErrorText error={remove.error} />
        <Button
          label="Đóng bài đăng"
          icon="trash-outline"
          variant="danger"
          pending={remove.isPending}
          onPress={() => remove.mutate()}
        />
      </BottomSheet>
      <ReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        targetId={post.id}
        targetType="POST"
      />
    </>
  );
}

const styles = StyleSheet.create({
  feed: { paddingHorizontal: 16, gap: 12, backgroundColor: "#e1e4e8" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 12,
    gap: 8,
    ...theme.shadow.card,
  },
  fullWidth: {
    marginHorizontal: -16,
    borderRadius: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
  },
  detailCard: { borderRadius: 0, elevation: 0, shadowOpacity: 0 },
  addressCopy: { flex: 1, gap: 3 },
  addressDetail: { color: theme.colors.inkMuted, fontSize: 11, lineHeight: 16 },
  detailsMeta: { flexDirection: "row", justifyContent: "space-between" },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  identity: { flex: 1, gap: 2 },
  ownerName: { color: theme.colors.ink, fontSize: 15, fontWeight: "800" },
  moreButton: {
    width: 42,
    height: 42,
    marginRight: -7,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    minHeight: 24,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  roleText: { fontSize: 11, fontWeight: "700" },
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
  addressField: {
    flex: 1,
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  originField: { backgroundColor: "transparent", borderColor: "#dcb84b" },
  destinationField: { backgroundColor: "transparent", borderColor: "#69b69a" },
  stopText: {
    color: theme.colors.ink,
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  mapPanel: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    overflow: "hidden",
  },
  map: { width: "100%", height: 190, borderRadius: 0 },
  summary: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  summaryItem: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    paddingVertical: 10,
    gap: 4,
  },
  summaryDivider: { borderLeftWidth: 1, borderLeftColor: theme.colors.border },
  summaryValue: {
    color: theme.colors.ink,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 16,
  },
  note: { color: theme.colors.inkMuted, fontSize: 13, lineHeight: 19 },
  footer: {
    paddingTop: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  requestButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  requestText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  detailsButton: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "#edf7f3",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
  },
  detailsText: { color: theme.colors.primary, fontSize: 12, fontWeight: "700" },
  deleteHint: { color: theme.colors.inkMuted, fontSize: 14, lineHeight: 21 },
  pressed: { opacity: 0.78 },
});
