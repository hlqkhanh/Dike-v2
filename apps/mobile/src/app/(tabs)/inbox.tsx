import { useMemo, useState } from "react";
import { router } from "expo-router";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Avatar, EmptyState, Icon, LoadingCards, Text } from "@/components/ui";
import { useMobileApi } from "@/core/hooks";
import { homeTheme as h } from "@/core/home-theme";
import { theme } from "@/core/theme";

function conversationTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const today = new Date();
  const dayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const valueStart = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const days = Math.round(
    (dayStart.getTime() - valueStart.getTime()) / 86_400_000,
  );
  if (days === 0)
    return date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  if (days === 1) return "Hôm qua";
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

export default function Inbox() {
  const api = useMobileApi();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"ALL" | "UNREAD" | "TRIP" | "DIRECT">(
    "ALL",
  );
  const query = useQuery({
    queryKey: ["mobile-conversations"],
    queryFn: api.conversations,
    refetchInterval: 10000,
  });
  const rows = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    return (query.data ?? []).filter((conversation) => {
      const matchesSearch =
        !keyword ||
        (conversation.recipientDisplayName || "Người cùng đường")
          .toLocaleLowerCase("vi")
          .includes(keyword);
      const matchesFilter =
        filter === "ALL" ||
        (filter === "UNREAD" && conversation.unreadCount > 0) ||
        (filter === "TRIP" && conversation.type === "BOOKING") ||
        (filter === "DIRECT" && conversation.type === "DIRECT");
      return matchesSearch && matchesFilter;
    });
  }, [filter, query.data, search]);
  const unreadTotal = (query.data ?? []).filter(
    (item) => item.unreadCount > 0,
  ).length;
  const recent = (query.data ?? []).slice(0, 6);

  return (
    <SafeAreaView edges={["top"]} style={styles.page}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            colors={[h.primary]}
            refreshing={query.isRefetching}
            tintColor={h.primary}
            onRefresh={() => void query.refetch()}
          />
        }
      >
        <View style={styles.brandRow}>
          <Text style={styles.brandName}>Diké</Text>
          <Pressable
            accessibilityLabel="Thông báo"
            accessibilityRole="button"
            onPress={() => router.push("/notifications")}
            style={styles.notification}
          >
            <Icon name="notifications-outline" size={22} color={h.ink} />
          </Pressable>
        </View>

        <View style={styles.body}>
          <View style={styles.search}>
            <Icon name="search-outline" size={22} color={h.muted} />
            <TextInput
              accessibilityLabel="Tìm người trò chuyện"
              onChangeText={setSearch}
              placeholder="Tìm người trò chuyện"
              placeholderTextColor={h.muted}
              returnKeyType="search"
              style={styles.searchInput}
              value={search}
            />
          </View>
          {recent.length ? (
            <ScrollView
              contentContainerStyle={styles.recent}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {recent.map((conversation) => (
                <Pressable
                  accessibilityLabel={`Mở trò chuyện với ${conversation.recipientDisplayName || "Người cùng đường"}`}
                  accessibilityRole="button"
                  key={conversation.id}
                  onPress={() =>
                    router.push({
                      pathname: "/chat/[id]",
                      params: { id: conversation.id },
                    })
                  }
                  style={styles.recentPerson}
                >
                  <View style={styles.recentAvatar}>
                    <Avatar
                      name={
                        conversation.recipientDisplayName || "Người cùng đường"
                      }
                      uri={conversation.recipientAvatarUrl}
                      size={62}
                    />
                  </View>
                  <Text numberOfLines={1} style={styles.recentName}>
                    {conversation.recipientDisplayName || "Người cùng đường"}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          <ScrollView
            contentContainerStyle={styles.filters}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {(
              [
                [
                  "ALL",
                  "chatbubble-ellipses-outline",
                  "Tất cả",
                  query.data?.length ?? 0,
                ],
                ["UNREAD", "mail-outline", "Chưa đọc", unreadTotal],
                ["TRIP", "navigate-outline", "Chuyến đi", undefined],
              ] as const
            ).map(([value, icon, label, count]) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: filter === value }}
                key={value}
                onPress={() => setFilter(value)}
                style={[styles.filter, filter === value && styles.filterActive]}
              >
                <Icon
                  name={icon}
                  size={18}
                  color={filter === value ? "#fff" : h.muted}
                />
                <Text
                  style={[
                    styles.filterText,
                    filter === value && styles.filterTextActive,
                  ]}
                >
                  {label}
                </Text>
                {count ? (
                  <View style={styles.filterCount}>
                    <Text style={styles.filterCountText}>{count}</Text>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
          {query.isLoading ? (
            <LoadingCards />
          ) : query.isError ? (
            <EmptyState
              title="Chưa tải được tin nhắn"
              icon="cloud-offline-outline"
              onRetry={() => void query.refetch()}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title={
                search
                  ? "Không tìm thấy cuộc trò chuyện"
                  : "Chưa có cuộc trò chuyện"
              }
              description={
                search
                  ? "Thử tìm bằng tên khác."
                  : "Khi kết nối thành công, cuộc trò chuyện sẽ xuất hiện tại đây."
              }
              icon="chatbubble-ellipses-outline"
            />
          ) : (
            <View style={styles.list}>
              {rows.map((conversation) => (
                <Pressable
                  accessibilityLabel={`Mở trò chuyện với ${conversation.recipientDisplayName || "Người cùng đường"}`}
                  accessibilityRole="button"
                  key={conversation.id}
                  onPress={() =>
                    router.push({
                      pathname: "/chat/[id]",
                      params: { id: conversation.id },
                    })
                  }
                  style={({ pressed }) => [
                    styles.conversation,
                    pressed && styles.pressed,
                  ]}
                >
                  <Avatar
                    name={
                      conversation.recipientDisplayName || "Người cùng đường"
                    }
                    uri={conversation.recipientAvatarUrl}
                    size={54}
                  />
                  <View style={styles.identity}>
                    <Text numberOfLines={1} style={styles.name}>
                      {conversation.recipientDisplayName || "Người cùng đường"}
                    </Text>
                    <Text numberOfLines={1} style={styles.preview}>
                      {conversation.lastMessageText ||
                        (conversation.canSend === false
                          ? "Đang chờ chấp nhận"
                          : "Bắt đầu trò chuyện")}
                    </Text>
                  </View>
                  <View style={styles.trailing}>
                    <Text style={styles.time}>
                      {conversationTime(conversation.lastMessageAt)}
                    </Text>
                    {conversation.unreadCount > 0 ? (
                      <View style={styles.unread}>
                        <Text style={styles.unreadText}>
                          {conversation.unreadCount}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { gap: theme.spacing.md, paddingHorizontal: 16 },
  brandName: {
    color: h.ink,
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: -1.2,
  },
  brandRow: {
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  content: { paddingBottom: 120 },
  conversation: {
    alignItems: "center",
    borderBottomColor: h.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 12,
    minHeight: 78,
    paddingHorizontal: 2,
    paddingVertical: 10,
  },
  filter: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    minHeight: 44,
    paddingHorizontal: 14,
  },
  filterActive: { backgroundColor: h.primary, borderColor: h.primary },
  filterCount: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 13,
    justifyContent: "center",
    minHeight: 26,
    minWidth: 26,
    paddingHorizontal: 6,
  },
  filterCountText: { color: h.primary, fontSize: 12, fontWeight: "800" },
  filters: { gap: 8, paddingRight: 16 },
  filterText: { color: h.muted, fontSize: 13, fontWeight: "700" },
  filterTextActive: { color: "#fff" },
  identity: { flex: 1, gap: 5, minWidth: 0 },
  list: { gap: 0 },
  name: { color: h.ink, fontSize: 16, fontWeight: "800" },
  notification: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    marginLeft: "auto",
    width: 48,
    ...theme.shadow.card,
  },
  page: { backgroundColor: "#ffffff", flex: 1 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  preview: { color: h.muted, fontSize: 12 },
  recent: { gap: 18, paddingHorizontal: 2, paddingRight: 18 },
  recentAvatar: {
    borderColor: h.primary,
    borderRadius: 36,
    borderWidth: 2,
    padding: 3,
  },
  recentName: { color: h.ink, fontSize: 12, maxWidth: 74, textAlign: "center" },
  recentPerson: { alignItems: "center", gap: 7, width: 76 },
  search: {
    alignItems: "center",
    backgroundColor: h.surface,
    borderColor: h.border,
    borderRadius: 28,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 18,
    ...theme.shadow.card,
  },
  searchInput: {
    color: h.ink,
    flex: 1,
    fontSize: 15,
    minHeight: 54,
    paddingVertical: 0,
  },
  time: { color: h.muted, fontSize: 12 },
  trailing: {
    alignItems: "flex-end",
    alignSelf: "stretch",
    justifyContent: "space-between",
  },
  unread: {
    alignItems: "center",
    backgroundColor: h.primary,
    borderRadius: 14,
    height: 28,
    justifyContent: "center",
    minWidth: 28,
    paddingHorizontal: 7,
  },
  unreadText: { color: h.surface, fontSize: 12, fontWeight: "800" },
});
