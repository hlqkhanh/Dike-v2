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
import type { JourneyMessage, RidePostResponse } from "@dike/api-client-ts";
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

const tripSteps = [
  { status: "ACCEPTED", label: "Xác nhận", icon: "checkmark" as const },
  { status: "DRIVER_STARTED", label: "Đến đón", icon: "play" as const },
  {
    status: "DRIVER_ARRIVED",
    label: "Điểm đón",
    icon: "location" as const,
  },
  { status: "COMPLETED", label: "Hoàn thành", icon: "navigate" as const },
] as const;

function PinnedTripProgress({ response }: { response?: RidePostResponse }) {
  const activeIndex = response
    ? tripSteps.findIndex((step) => step.status === response.status)
    : -1;

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
      {tripSteps.map((step, index) => {
        const complete = activeIndex >= index;
        return (
          <View
            key={step.status}
            style={{
              flex: 1,
              alignItems: "center",
              gap: 4,
              position: "relative",
            }}
          >
            {index > 0 ? (
              <View
                style={{
                  position: "absolute",
                  right: "50%",
                  top: 10,
                  width: "100%",
                  height: 2,
                  backgroundColor: complete ? "#0a9a73" : "#cbd8d3",
                }}
              />
            ) : null}
            <View
              style={{
                zIndex: 1,
                width: 22,
                height: 22,
                borderRadius: 11,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: complete ? "#0a9a73" : "#cbd8d3",
                backgroundColor: complete ? "#0a9a73" : "#fff",
              }}
            >
              <Icon
                name={step.icon}
                size={11}
                color={complete ? "#fff" : "#8ca198"}
              />
            </View>
            <Text
              numberOfLines={2}
              style={{
                minHeight: 22,
                color: complete ? "#087d61" : "#8ca198",
                fontSize: 8,
                lineHeight: 10,
                fontWeight: complete ? "800" : "600",
                textAlign: "center",
              }}
            >
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

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
  const pinnedPost = useQuery({
    queryKey: ["mobile-post", info.data?.postId],
    queryFn: () => api.post(info.data!.postId!),
    enabled: Boolean(info.data?.postId),
    retry: false,
  });
  const pinnedResponses = useQuery({
    queryKey: ["mobile-post-responses", info.data?.postId],
    queryFn: () => api.postResponses(info.data!.postId!),
    enabled: Boolean(info.data?.postId),
    retry: false,
    refetchInterval: 10000,
  });
  const pinnedResponse = pinnedResponses.data?.find(
    (response) =>
      response.conversationId === id &&
      ["ACCEPTED", "DRIVER_STARTED", "DRIVER_ARRIVED", "COMPLETED"].includes(
        response.status,
      ),
  );
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
    <SafeAreaView style={{ flex: 1, backgroundColor: "#ffffff" }}>
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
              borderColor: "#f1f5f9",
              backgroundColor: "#ffffff",
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
        {pinnedPost.data ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mở chi tiết chuyến đi đã ghim"
            onPress={() =>
              router.push({
                pathname: "/posts/[id]",
                params: { id: pinnedPost.data.id },
              })
            }
            style={({ pressed }) => ({
              marginHorizontal: 14,
              marginTop: 10,
              borderWidth: 1,
              borderColor: "#cfe9df",
              borderRadius: 16,
              overflow: "hidden",
              backgroundColor: pressed ? "#eaf7f1" : "#f5fbf8",
            })}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 13,
                paddingVertical: 9,
                borderBottomWidth: 1,
                borderBottomColor: "#dceee6",
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
              >
                <Icon name="pin" size={16} />
                <Text
                  style={{ color: "#075f4b", fontSize: 13, fontWeight: "800" }}
                >
                  Chuyến đi đã ghim
                </Text>
              </View>
              <Icon name="chevron-forward" size={17} color="#087d61" />
            </View>
            <View style={{ padding: 12, gap: 11 }}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
              >
                <Icon name="location" size={16} />
                <Text
                  numberOfLines={1}
                  style={{ flex: 1, fontSize: 12, fontWeight: "700" }}
                >
                  {pinnedPost.data.originLabel}
                </Text>
                <Icon name="arrow-forward" size={14} color="#6f857c" />
                <Icon name="flag" size={15} color="#e9a400" />
                <Text
                  numberOfLines={1}
                  style={{ flex: 1, fontSize: 12, fontWeight: "700" }}
                >
                  {pinnedPost.data.destinationLabel}
                </Text>
              </View>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
              >
                <Icon name="calendar-outline" size={15} />
                <Text
                  style={{ color: "#526b61", fontSize: 11, fontWeight: "600" }}
                >
                  {dateTime(pinnedPost.data.departureAt)}
                </Text>
              </View>
              <PinnedTripProgress response={pinnedResponse} />
            </View>
          </Pressable>
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
                  backgroundColor: own ? "#087d61" : "#f1f5f9",
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
                    color: own ? "#fff" : "#0f172a",
                  }}
                >
                  {m.hidden ? "Tin nhắn đã được ẩn" : m.text}
                </Text>
                <Text
                  style={{ fontSize: 10, color: own ? "#e6fff2" : "#64748b" }}
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
            borderColor: "#f1f5f9",
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
