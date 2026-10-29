import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { randomUUID } from "expo-crypto";
import { useMutation } from "@tanstack/react-query";
import type { RidePostView } from "@dike/api-client-ts";
import { dateTime, statusLabel, useMobileApi } from "@/core/hooks";
import { theme } from "@/core/theme";
import { Avatar, BottomSheet, Button, ErrorText, Icon, Text } from "./ui";
import { PostRoutePreview } from "./PostRoutePreview";
import { ReportSheet } from "./ReportSheet";

export function RidePostCard({
  post,
  viewerId,
  onChanged,
}: {
  post: RidePostView;
  viewerId?: string;
  onChanged?: () => void;
}) {
  const api = useMobileApi();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const passenger = post.type === "NEED_RIDE";
  const own = post.ownerId === viewerId;
  const accent = passenger ? theme.colors.passenger : theme.colors.primary;
  const soft = passenger ? theme.colors.passengerSoft : "#e8f7f1";
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

  return (
    <>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Xem chuyến từ ${post.originLabel} đến ${post.destinationLabel}`}
        onPress={openPost}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <View style={styles.header}>
          <Avatar
            name={post.ownerDisplayName}
            uri={post.ownerAvatarUrl}
            size={44}
          />
          <View style={styles.identity}>
            <Text numberOfLines={1} style={styles.ownerName}>
              {post.ownerDisplayName}
            </Text>
            <Text style={styles.ownerMeta}>
              {post.visibility === "PUBLIC"
                ? "Hành trình công khai"
                : "Hành trình cộng đồng"}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mở tùy chọn bài đăng"
            onPress={(event) => {
              event.stopPropagation();
              setMenuOpen(true);
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

        <View style={styles.topRow}>
          <View style={[styles.roleBadge, { backgroundColor: soft }]}>
            <Icon
              name={passenger ? "person-outline" : "car-outline"}
              size={16}
              color={accent}
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
          <Text style={styles.date}>{dateTime(post.departureAt)}</Text>
        </View>

        <View style={styles.route}>
          <View style={styles.stopRow}>
            <View style={styles.stopIcon}>
              <Icon name="location-outline" size={20} color={accent} />
            </View>
            <Text numberOfLines={2} style={styles.stopText}>
              {post.originLabel}
            </Text>
          </View>
          <View style={[styles.stopLine, { backgroundColor: accent }]} />
          <View style={styles.stopRow}>
            <View style={styles.stopIcon}>
              <Icon name="flag-outline" size={20} color={accent} />
            </View>
            <Text numberOfLines={2} style={styles.stopText}>
              {post.destinationLabel}
            </Text>
          </View>
        </View>

        <PostRoutePreview postId={post.id} style={styles.map} />

        {post.note ? (
          <Text numberOfLines={2} style={styles.note}>
            {post.note}
          </Text>
        ) : null}
        <View style={styles.footer}>
          <View style={styles.meta}>
            <Icon
              name={
                post.vehicleType === "CAR" ? "car-outline" : "bicycle-outline"
              }
              size={17}
              color={theme.colors.inkMuted}
            />
            <Text style={styles.metaText}>
              {post.vehicleType === "CAR" ? "Ô tô" : "Xe máy"}
            </Text>
          </View>
          <View style={styles.meta}>
            <Icon
              name="people-outline"
              size={17}
              color={theme.colors.inkMuted}
            />
            <Text style={styles.metaText}>
              {post.pendingResponseCount} yêu cầu
            </Text>
          </View>
          <Text style={[styles.status, { color: accent }]}>
            {statusLabel(post.status)}
          </Text>
          <Icon name="chevron-forward" size={18} color={accent} />
        </View>
      </Pressable>

      <BottomSheet
        visible={menuOpen}
        title="Tùy chọn bài đăng"
        onClose={() => setMenuOpen(false)}
      >
        <Button
          label={own ? "Quản lý bài đăng" : "Xem bài đăng"}
          icon={own ? "create-outline" : "eye-outline"}
          variant="secondary"
          onPress={() => {
            setMenuOpen(false);
            openPost();
          }}
        />
        {own && post.status === "OPEN" ? (
          <Button
            label="Xóa bài đăng"
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
        title="Xóa bài đăng?"
        onClose={() => setConfirmDelete(false)}
      >
        <Text style={styles.deleteHint}>
          Bài đăng sẽ được đóng, ngừng nhận yêu cầu mới và không còn xuất hiện
          trong danh sách hiện tại.
        </Text>
        <ErrorText error={remove.error} />
        <Button
          label="Xóa bài đăng"
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
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 20,
    padding: 14,
    gap: 13,
    ...theme.shadow.card,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  identity: { flex: 1, gap: 2 },
  ownerName: { color: theme.colors.ink, fontSize: 15, fontWeight: "800" },
  ownerMeta: { color: theme.colors.inkMuted, fontSize: 11 },
  moreButton: {
    width: 42,
    height: 42,
    marginRight: -7,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
  },
  topRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  roleText: { fontSize: 12, fontWeight: "800" },
  date: {
    marginLeft: "auto",
    flexShrink: 1,
    color: theme.colors.inkMuted,
    fontSize: 11,
    fontWeight: "600",
    textAlign: "right",
  },
  route: { position: "relative", gap: 14, backgroundColor: "#fff" },
  stopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: "#fff",
    zIndex: 1,
  },
  stopIcon: {
    width: 22,
    alignItems: "center",
    paddingTop: 1,
    backgroundColor: "#fff",
  },
  stopLine: {
    position: "absolute",
    left: 23,
    top: 20,
    bottom: 20,
    width: 2,
    opacity: 0.4,
  },
  stopText: {
    flex: 1,
    color: theme.colors.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  map: { width: "100%", height: 180, borderRadius: 16 },
  note: { color: theme.colors.inkMuted, fontSize: 13, lineHeight: 19 },
  footer: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  meta: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { color: theme.colors.inkMuted, fontSize: 11 },
  status: { marginLeft: "auto", fontSize: 11, fontWeight: "800" },
  deleteHint: { color: theme.colors.inkMuted, fontSize: 14, lineHeight: 21 },
  pressed: { opacity: 0.78 },
});
