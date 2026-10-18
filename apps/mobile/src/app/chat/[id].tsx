import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { DetailPage, detailStyles } from "@/components/DetailPage";
import { createMobileApi } from "@/core/api";
import { useSession } from "@/core/session";
import { theme } from "@/core/theme";

export default function Chat() {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const { token, session } = useSession();
  const api = createMobileApi(() => Promise.resolve(token));
  const info = useQuery({
    queryKey: ["mobile-conversation", id],
    queryFn: () => api.conversation(id),
    enabled: Boolean(id),
  });
  const messages = useQuery({
    queryKey: ["mobile-messages", id],
    queryFn: () => api.messages(id),
    enabled: Boolean(id),
    refetchInterval: 5_000,
  });
  const post = useQuery({
    queryKey: ["mobile-chat-post", info.data?.postId],
    queryFn: () => api.post(info.data!.postId!),
    enabled: Boolean(info.data?.postId),
  });
  const [text, setText] = useState("");
  const send = useMutation({
    mutationFn: () => api.sendMessage(id, text.trim()),
    onSuccess: () => {
      setText("");
      void messages.refetch();
    },
  });
  return (
    <DetailPage
      loading={info.isLoading}
      subtitle="Đang trò chuyện"
      title={info.data?.recipientDisplayName || "Tin nhắn"}
    >
      {post.data ? (
        <Link
          asChild
          href={{ pathname: "/posts/[id]", params: { id: post.data.id } }}
        >
          <Pressable style={styles.pinned}>
            <Text style={detailStyles.eyebrow}>📌 CHUYẾN ĐI ĐÃ GHIM</Text>
            <View style={styles.pinnedRoute}>
              <Text numberOfLines={1} style={styles.pinnedPlace}>
                {post.data.originLabel}
              </Text>
              <Text style={styles.routeArrow}>→</Text>
              <Text numberOfLines={1} style={styles.pinnedPlace}>
                {post.data.destinationLabel}
              </Text>
            </View>
            <Text style={detailStyles.muted}>
              ▣ {new Date(post.data.departureAt).toLocaleString("vi-VN")}
            </Text>
          </Pressable>
        </Link>
      ) : null}
      <View style={styles.thread}>
        {(messages.data ?? []).map((message) => {
          const own = message.senderId === session?.user.id;
          return (
            <View
              key={message.id}
              style={[styles.bubble, own ? styles.own : styles.other]}
            >
              <Text style={[styles.message, own && styles.ownText]}>
                {message.text}
              </Text>
              <Text style={[styles.time, own && styles.ownTime]}>
                {new Date(message.createdAt).toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          );
        })}
        {messages.data?.length === 0 ? (
          <Text style={detailStyles.muted}>
            Hãy gửi lời chào để bắt đầu trao đổi.
          </Text>
        ) : null}
      </View>
      <View style={styles.composer}>
        <TextInput
          onChangeText={setText}
          placeholder="Nhập tin nhắn..."
          style={[detailStyles.field, styles.input]}
          value={text}
        />
        <Pressable
          disabled={!text.trim() || send.isPending}
          onPress={() => send.mutate()}
          style={styles.send}
        >
          <Text style={styles.sendText}>➤</Text>
        </Pressable>
      </View>
    </DetailPage>
  );
}

const styles = StyleSheet.create({
  pinned: {
    ...theme.shadow.card,
    backgroundColor: "#fff",
    borderColor: "#bfe3d6",
    borderRadius: 17,
    borderWidth: 1,
    gap: 9,
    padding: 15,
  },
  pinnedRoute: { alignItems: "center", flexDirection: "row", gap: 9 },
  pinnedPlace: {
    color: theme.colors.ink,
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
  },
  routeArrow: {
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: 15,
    color: "#fff",
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  thread: {
    backgroundColor: "#f8fcfa",
    borderRadius: 18,
    gap: 9,
    minHeight: 300,
    padding: 14,
  },
  bubble: {
    borderRadius: 15,
    maxWidth: "82%",
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  own: { alignSelf: "flex-end", backgroundColor: theme.colors.primary },
  other: { alignSelf: "flex-start", backgroundColor: "#eaf3ef" },
  message: { color: theme.colors.ink, fontSize: 14 },
  ownText: { color: "#fff" },
  time: { color: "#81938c", fontSize: 9, marginTop: 4 },
  ownTime: { color: "#c9eee1" },
  composer: { alignItems: "center", flexDirection: "row", gap: 9 },
  input: { flex: 1 },
  send: {
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  sendText: { color: "#fff", fontSize: 20 },
});
