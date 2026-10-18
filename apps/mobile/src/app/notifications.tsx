import { useMutation, useQuery } from "@tanstack/react-query";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { DetailPage, detailStyles } from "@/components/DetailPage";
import { createMobileApi } from "@/core/api";
import { useSession } from "@/core/session";
import { theme } from "@/core/theme";
export default function Notifications() {
  const { token } = useSession();
  const api = createMobileApi(() => Promise.resolve(token));
  const query = useQuery({
    queryKey: ["mobile-notifications"],
    queryFn: api.notifications,
  });
  const read = useMutation({
    mutationFn: api.readNotification,
    onSuccess: () => void query.refetch(),
  });
  const items = [...(query.data ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return (
    <DetailPage
      loading={query.isLoading}
      subtitle="Mới nhất được hiển thị trước"
      title="Thông báo"
    >
      {items.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => !item.readAt && read.mutate(item.id)}
          style={[styles.item, !item.readAt && styles.unread]}
        >
          <View style={styles.icon}>
            <Text>🔔</Text>
          </View>
          <View style={styles.copy}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={detailStyles.muted}>{item.body}</Text>
            <Text style={styles.time}>
              {new Date(item.createdAt).toLocaleString("vi-VN")}
            </Text>
          </View>
          {!item.readAt ? <View style={styles.dot} /> : null}
        </Pressable>
      ))}
      {items.length === 0 ? (
        <Text style={detailStyles.muted}>Chưa có thông báo mới.</Text>
      ) : null}
    </DetailPage>
  );
}
const styles = StyleSheet.create({
  item: {
    ...theme.shadow.card,
    alignItems: "flex-start",
    backgroundColor: "#fff",
    borderColor: theme.colors.border,
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: "row",
    gap: 11,
    padding: 14,
  },
  unread: { backgroundColor: "#f0faf6", borderColor: "#9bd6c1" },
  icon: {
    alignItems: "center",
    backgroundColor: "#e3f6ef",
    borderRadius: 19,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  copy: { flex: 1, gap: 3 },
  title: { color: theme.colors.ink, fontSize: 14, fontWeight: "800" },
  time: { color: "#8a9a95", fontSize: 10 },
  dot: { backgroundColor: "#ef4444", borderRadius: 5, height: 9, width: 9 },
});
