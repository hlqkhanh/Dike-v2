import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { JourneyNotification } from "@dike/api-client-ts";
import { DetailPage } from "@/components/DetailPage";
import { ResourceState } from "@/components/ResourceState";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorText,
  Icon,
  Text,
  ui,
} from "@/components/ui";
import { useMobileApi, dateTime } from "@/core/hooks";
export default function Notifications() {
  const api = useMobileApi();
  const query = useQuery({
    queryKey: ["mobile-notifications"],
    queryFn: api.notifications,
    refetchInterval: 15000,
  });
  const read = useMutation({
    mutationFn: async (n: JourneyNotification) => {
      if (!n.readAt) await api.readNotification(n.id);
      await query.refetch();
      const d = n.data;
      if (d.conversationId)
        router.push({
          pathname: "/chat/[id]",
          params: { id: d.conversationId },
        });
      else if (d.bookingId)
        router.push({ pathname: "/booking/[id]", params: { id: d.bookingId } });
      else if (d.tripId)
        router.push({ pathname: "/trip/[id]", params: { id: d.tripId } });
      else if (d.postId)
        router.push({ pathname: "/posts/[id]", params: { id: d.postId } });
    },
  });
  const all = useMutation({
    mutationFn: () => api.call("/notifications/read-all", "POST"),
    onSuccess: () => void query.refetch(),
  });
  const groups = new Map<string, JourneyNotification[]>();
  for (const n of query.data ?? []) {
    const day = new Date(n.createdAt).toLocaleDateString("vi-VN");
    groups.set(day, [...(groups.get(day) ?? []), n]);
  }
  return (
    <DetailPage
      title="Thông báo"
      subtitle="Những cập nhật dành riêng cho bạn"
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching}
    >
      <View
        style={[
          ui.row,
          { backgroundColor: "#e4f5ec", borderRadius: 24, padding: 18 },
        ]}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 18,
            backgroundColor: "#fff",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="notifications-outline" size={26} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={ui.sectionTitle}>Luôn cùng nhịp</Text>
          <Text style={ui.muted}>
            Tin nhắn và cập nhật hành trình tại một nơi.
          </Text>
        </View>
      </View>
      {query.data?.some((n) => !n.readAt) ? (
        <Button
          label="Đánh dấu tất cả đã đọc"
          variant="secondary"
          pending={all.isPending}
          onPress={() => all.mutate()}
        />
      ) : null}
      <ErrorText error={read.error || all.error} />
      <ResourceState query={query}>
        {query.data?.length === 0 ? (
          <EmptyState
            title="Bạn đã xem hết rồi"
            description="Thông báo mới sẽ xuất hiện tại đây."
            icon="notifications-outline"
          />
        ) : null}
        {Array.from(groups).map(([day, rows]) => (
          <View key={day} style={{ gap: 12 }}>
            <Text style={ui.eyebrow}>{day}</Text>
            {rows.map((n) => (
              <Pressable
                key={n.id}
                accessibilityRole="button"
                disabled={read.isPending}
                onPress={() => read.mutate(n)}
              >
                <Card
                  style={{ backgroundColor: n.readAt ? "#fff" : "#e9f6ef" }}
                >
                  <View style={ui.row}>
                    <Icon name="notifications-outline" />
                    <Text style={[ui.sectionTitle, { fontSize: 16, flex: 1 }]}>
                      {n.title}
                    </Text>
                    {!n.readAt ? <Badge label="Mới" /> : null}
                  </View>
                  <Text style={ui.muted}>{n.body}</Text>
                  <Text style={[ui.muted, { fontSize: 12 }]}>
                    {dateTime(n.createdAt)}
                  </Text>
                </Card>
              </Pressable>
            ))}
          </View>
        ))}
      </ResourceState>
    </DetailPage>
  );
}
