import type { JourneyConversation } from "@dike/api-client-ts";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { ImageStyle } from "react-native";

import { Screen, sharedStyles } from "@/components/Screen";
import { createMobileApi } from "@/core/api";
import { useSession } from "@/core/session";
import { theme } from "@/core/theme";

export default function Inbox() {
  const { token } = useSession();
  const query = useQuery({
    queryKey: ["mobile-conversations"],
    queryFn: () =>
      createMobileApi(() => Promise.resolve(token)).conversations(),
    refetchInterval: 15_000,
  });
  const conversations = [...(query.data ?? [])].sort(
    (left, right) =>
      new Date(right.lastMessageAt ?? 0).getTime() -
      new Date(left.lastMessageAt ?? 0).getTime(),
  );
  const unread = conversations.reduce(
    (total, item) => total + item.unreadCount,
    0,
  );

  return (
    <Screen
      loading={query.isLoading}
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching}
      subtitle="Kết nối và trao đổi cùng người đồng hành"
      title="Bạn bè"
    >
      <View style={styles.summaryRow}>
        <Summary label="Hội thoại" value={conversations.length} />
        <Summary label="Chưa đọc" value={unread} />
      </View>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.eyebrow}>TIN NHẮN</Text>
          <Text style={styles.sectionTitle}>Hội thoại gần đây</Text>
        </View>
        <Text style={styles.count}>{conversations.length}</Text>
      </View>
      {query.isError ? (
        <Text accessibilityRole="alert" style={sharedStyles.empty}>
          Không tải được hội thoại. Kéo xuống để thử lại.
        </Text>
      ) : null}
      {!query.isError && conversations.length === 0 ? (
        <Text style={sharedStyles.empty}>Bạn chưa có cuộc trò chuyện nào.</Text>
      ) : null}
      {conversations.map((conversation) => (
        <ConversationCard conversation={conversation} key={conversation.id} />
      ))}
    </Screen>
  );
}

function Summary({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.summary}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function ConversationCard({
  conversation,
}: {
  conversation: JourneyConversation;
}) {
  const name = conversation.recipientDisplayName || "Thành viên Diké";
  const time = conversation.lastMessageAt
    ? new Date(conversation.lastMessageAt).toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
      })
    : "Mới";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push({ pathname: "/chat/[id]", params: { id: conversation.id } })
      }
      style={({ pressed }) => [styles.conversation, pressed && styles.pressed]}
    >
      {conversation.recipientAvatarUrl ? (
        <Image
          source={{ uri: conversation.recipientAvatarUrl }}
          style={styles.avatar as ImageStyle}
        />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarText}>
            {name.trim().charAt(0).toUpperCase() || "D"}
          </Text>
        </View>
      )}
      <View style={styles.conversationCopy}>
        <View style={styles.nameRow}>
          <Text numberOfLines={1} style={styles.name}>
            {name}
          </Text>
          <Text style={styles.time}>{time}</Text>
        </View>
        <Text numberOfLines={1} style={styles.description}>
          {conversation.postId
            ? "Tin nhắn về chuyến đi đã ghim"
            : "Tin nhắn giữa hai thành viên"}
        </Text>
        <View style={styles.stateRow}>
          <View style={styles.onlineDot} />
          <Text style={styles.stateText}>
            {conversation.canSend === false ? "Đã đóng" : "Đang hoạt động"}
          </Text>
        </View>
      </View>
      {conversation.unreadCount > 0 ? (
        <View style={styles.unread}>
          <Text style={styles.unreadText}>{conversation.unreadCount}</Text>
        </View>
      ) : (
        <Text style={styles.chevron}>›</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  summaryRow: { flexDirection: "row", gap: 10 },
  summary: {
    ...theme.shadow.card,
    backgroundColor: "#fff",
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flex: 1,
    padding: 15,
  },
  summaryValue: {
    color: theme.colors.primary,
    fontSize: 22,
    fontWeight: "900",
  },
  summaryLabel: { color: theme.colors.inkMuted, fontSize: 12, marginTop: 2 },
  sectionHeader: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  eyebrow: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  sectionTitle: {
    color: theme.colors.ink,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 3,
  },
  count: {
    backgroundColor: "#def5ec",
    borderRadius: theme.radius.pill,
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  conversation: {
    ...theme.shadow.card,
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    padding: 14,
  },
  pressed: { opacity: 0.86 },
  avatar: { borderRadius: 27, height: 54, width: 54 },
  avatarFallback: {
    alignItems: "center",
    backgroundColor: "#ddf4eb",
    justifyContent: "center",
  },
  avatarText: { color: theme.colors.primary, fontSize: 19, fontWeight: "900" },
  conversationCopy: { flex: 1, gap: 4, marginLeft: 12 },
  nameRow: { alignItems: "center", flexDirection: "row" },
  name: { color: theme.colors.ink, flex: 1, fontSize: 15, fontWeight: "800" },
  time: { color: "#80938d", fontSize: 11 },
  description: { color: "#71857f", fontSize: 12 },
  stateRow: { alignItems: "center", flexDirection: "row", gap: 5 },
  onlineDot: {
    backgroundColor: "#10a77b",
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  stateText: { color: "#528073", fontSize: 11, fontWeight: "600" },
  unread: {
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    height: 24,
    justifyContent: "center",
    minWidth: 24,
    paddingHorizontal: 6,
  },
  unreadText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  chevron: { color: "#789087", fontSize: 26, marginLeft: 8 },
});
