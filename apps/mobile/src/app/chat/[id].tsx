import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import type { JourneyMessage } from "@dike/api-client-ts";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorText,
  Field,
  Icon,
  Text,
  ui,
} from "@/components/ui";
import { useMobileApi, dateTime } from "@/core/hooks";
import { useSession } from "@/core/session";
import { useReducedMotion } from "@/core/accessibility";
export default function Chat() {
  const reducedMotion = useReducedMotion();
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const api = useMobileApi();
  const { session } = useSession();
  const client = useQueryClient();
  const [text, setText] = useState("");
  const list = useRef<FlatList<JourneyMessage>>(null);
  const seen = useRef(0);
  const info = useQuery({
    queryKey: ["mobile-conversation", id],
    queryFn: () => api.conversation(id),
    refetchInterval: 10000,
  });
  const messages = useQuery({
    queryKey: ["mobile-messages", id],
    queryFn: () => api.messages(id),
    refetchInterval: 4000,
  });
  const send = useMutation({
    mutationFn: (value: { text: string; clientMessageId: string }) =>
      api.sendMessage(id, value.text, value.clientMessageId),
    onSuccess: (_, value) => {
      setText((current) => (current === value.text ? "" : current));
      void messages.refetch();
      void client.invalidateQueries({ queryKey: ["mobile-conversations"] });
    },
  });
  const decide = useMutation({
    mutationFn: (accept: boolean) =>
      api.call(
        `/message-requests/${id}/${accept ? "accept" : "reject"}`,
        "POST",
        { version: info.data!.version },
      ),
    onSuccess: () => void info.refetch(),
  });
  const sorted = [...(messages.data ?? [])].sort(
    (a, b) => a.sequence - b.sequence,
  );
  const last = sorted.at(-1)?.sequence ?? 0;
  useEffect(() => {
    if (last <= seen.current) return;
    let cancelled = false;
    void api
      .call(`/conversations/${id}/read`, "POST", { sequence: last })
      .then(() => {
        if (!cancelled) {
          seen.current = last;
          void client.invalidateQueries({ queryKey: ["mobile-conversations"] });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [api, id, last, client]);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f3faf7" }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View
          style={[
            ui.row,
            {
              padding: 16,
              borderBottomWidth: 1,
              borderColor: "#deece5",
              backgroundColor: "#f7fcf9",
              paddingVertical: 18,
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
            style={ui.iconButton}
            onPress={() =>
              router.canGoBack()
                ? router.back()
                : router.replace("/(tabs)/inbox")
            }
          >
            <Icon name="arrow-back" />
          </Pressable>
          <Avatar
            size={48}
            name={info.data?.recipientDisplayName}
            uri={info.data?.recipientAvatarUrl}
          />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: "800" }}>
              {info.data?.recipientDisplayName || "Tin nhắn"}
            </Text>
            <Text style={[ui.muted, { fontSize: 11 }]}>Người cùng đường</Text>
          </View>
        </View>
        {info.isError ? (
          <EmptyState
            title="Chưa tải được hội thoại"
            onRetry={() => void info.refetch()}
          />
        ) : null}
        {info.data?.state === "REQUEST_PENDING" &&
        info.data.canSend === false ? (
          <Card>
            <Text style={ui.muted}>
              Bạn có muốn nhận lời mời trò chuyện này?
            </Text>
            <Button
              label="Chấp nhận"
              pending={decide.isPending}
              onPress={() => decide.mutate(true)}
            />
            <Button
              label="Từ chối"
              variant="secondary"
              pending={decide.isPending}
              onPress={() => decide.mutate(false)}
            />
            <ErrorText error={decide.error} />
          </Card>
        ) : null}
        <FlatList
          ref={list}
          data={sorted}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 20, gap: 12, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() =>
            list.current?.scrollToEnd({ animated: !reducedMotion })
          }
          ListEmptyComponent={
            <EmptyState
              title={
                messages.isLoading
                  ? "Đang tải tin nhắn…"
                  : "Bắt đầu bằng một lời chào"
              }
              description="Trao đổi điểm đón và thời gian với người cùng đi."
              icon="chatbubbles-outline"
            />
          }
          ListHeaderComponent={
            messages.isError ? (
              <EmptyState
                title="Chưa tải được tin nhắn"
                onRetry={() => void messages.refetch()}
              />
            ) : null
          }
          renderItem={({ item: m }) => {
            const own = m.senderId === session?.user.id;
            return (
              <View
                style={{
                  alignSelf: own ? "flex-end" : "flex-start",
                  maxWidth: "88%",
                  backgroundColor: own ? "#087d61" : "#fff",
                  padding: 14,
                  borderRadius: 20,
                  borderBottomRightRadius: own ? 5 : 20,
                  borderBottomLeftRadius: own ? 20 : 5,
                  gap: 7,
                }}
              >
                {m.ridePost && !m.hidden ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({
                        pathname: "/posts/[id]",
                        params: { id: m.ridePost!.postId },
                      })
                    }
                  >
                    <Text
                      style={{
                        color: own ? "#fff" : "#087d61",
                        fontSize: 14,
                        fontWeight: "700",
                      }}
                    >
                      {m.ridePost.originLabel} · {m.ridePost.destinationLabel}
                    </Text>
                  </Pressable>
                ) : null}
                <Text
                  style={{
                    fontSize: 15,
                    lineHeight: 23,
                    color: own ? "#fff" : "#12342d",
                  }}
                >
                  {m.hidden ? "Tin nhắn đã được ẩn" : m.text}
                </Text>
                <Text
                  style={{ fontSize: 10, color: own ? "#e6fff2" : "#526e62" }}
                >
                  {dateTime(m.createdAt)}
                </Text>
              </View>
            );
          }}
        />
        {send.isError ? (
          <View style={{ padding: 16, gap: 8 }}>
            <ErrorText error={send.error} />
            <Button
              label="Gửi lại tin nhắn"
              variant="secondary"
              pending={send.isPending}
              onPress={() => send.variables && send.mutate(send.variables)}
            />
          </View>
        ) : null}
        <View
          style={{
            padding: 16,
            backgroundColor: "#fff",
            borderTopWidth: 1,
            borderColor: "#deece5",
            gap: 12,
          }}
        >
          <Field
            label="Tin nhắn"
            value={text}
            onChangeText={setText}
            placeholder={
              info.data?.canSend === false
                ? "Chờ lời mời được chấp nhận"
                : "Nhập lời nhắn…"
            }
            editable={info.data?.canSend !== false && !send.isError}
            multiline
            maxLength={2000}
          />
          <Button
            label="Gửi tin nhắn"
            icon="send-outline"
            disabled={
              !text.trim() || info.data?.canSend === false || send.isError
            }
            pending={send.isPending}
            onPress={() =>
              send.mutate({ text: text.trim(), clientMessageId: randomUUID() })
            }
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
