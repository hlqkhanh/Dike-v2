import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { DetailPage, detailStyles } from "@/components/DetailPage";
import { createMobileApi } from "@/core/api";
import { useSession } from "@/core/session";
import { theme } from "@/core/theme";

export default function PostDetail() {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const { token, session } = useSession();
  const api = createMobileApi(() => Promise.resolve(token));
  const post = useQuery({
    queryKey: ["mobile-post", id],
    queryFn: () => api.post(id),
    enabled: Boolean(id),
  });
  const responses = useQuery({
    queryKey: ["mobile-post-responses", id],
    queryFn: () => api.postResponses(id),
    enabled: Boolean(id),
  });
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const request = useMutation({
    mutationFn: () => api.requestRide(id, message.trim()),
    onSuccess: () => {
      setOpen(false);
      void responses.refetch();
    },
  });
  const data = post.data;
  const sent = responses.data?.some(
    (item) =>
      item.requesterId === session?.user.id &&
      !["REJECTED", "WITHDRAWN"].includes(item.status),
  );
  return (
    <DetailPage
      loading={post.isLoading}
      subtitle="Thông tin tuyến đường và người đăng"
      title="Chi tiết bài đăng"
    >
      {post.isError ? (
        <Text style={detailStyles.muted}>Không tải được bài đăng.</Text>
      ) : null}
      {data ? (
        <>
          <View style={detailStyles.card}>
            <View style={styles.author}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {data.ownerDisplayName.charAt(0)}
                </Text>
              </View>
              <View>
                <Text style={styles.authorName}>{data.ownerDisplayName}</Text>
                <Text style={detailStyles.muted}>Hành trình công khai</Text>
              </View>
              <Text style={styles.badge}>
                {data.type === "NEED_RIDE" ? "Tôi đi ké" : "Tôi chở"}
              </Text>
            </View>
            <View style={styles.route}>
              <Text style={styles.label}>Điểm đón</Text>
              <Text style={styles.place}>{data.originLabel}</Text>
              <Text style={styles.arrow}>↓</Text>
              <Text style={styles.label}>Điểm đến</Text>
              <Text style={styles.place}>{data.destinationLabel}</Text>
            </View>
            <View style={styles.meta}>
              <Text>
                ▣ {new Date(data.departureAt).toLocaleString("vi-VN")}
              </Text>
              <Text>▰ {data.vehicleType === "CAR" ? "Ô tô" : "Xe máy"}</Text>
              <Text>♙ {data.remainingSeats} chỗ</Text>
            </View>
            {data.note ? (
              <Text style={detailStyles.muted}>{data.note}</Text>
            ) : null}
          </View>
          {data.ownerId !== session?.user.id ? (
            <Pressable
              disabled={sent}
              onPress={() => setOpen(true)}
              style={[detailStyles.primaryButton, sent && styles.disabled]}
            >
              <Text style={detailStyles.primaryButtonText}>
                {sent
                  ? "Đã gửi yêu cầu"
                  : data.type === "NEED_RIDE"
                    ? "Chở ngay"
                    : "Đi ké ngay"}
              </Text>
            </Pressable>
          ) : (
            <View style={detailStyles.card}>
              <Text style={detailStyles.heading}>
                {data.pendingResponseCount} yêu cầu kết nối
              </Text>
              <Text style={detailStyles.muted}>Đây là bài đăng của bạn.</Text>
            </View>
          )}
        </>
      ) : null}
      <Modal
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        transparent
        visible={open}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={detailStyles.eyebrow}>XÁC NHẬN NHANH</Text>
            <Text style={styles.modalTitle}>Gửi yêu cầu kết nối?</Text>
            <Text style={detailStyles.muted}>
              Yêu cầu sẽ được gửi tới người đăng. Hai bên chỉ trao đổi sau khi
              được xác nhận.
            </Text>
            {data ? (
              <View style={styles.modalRoute}>
                <Text style={styles.modalPlace}>{data.originLabel}</Text>
                <Text style={styles.arrow}>↓</Text>
                <Text style={styles.modalPlace}>{data.destinationLabel}</Text>
              </View>
            ) : null}
            <Text style={styles.inputLabel}>Lời nhắn cho tác giả</Text>
            <TextInput
              maxLength={300}
              multiline
              onChangeText={setMessage}
              placeholder="Ví dụ: Mình có thể đi nhé..."
              style={[detailStyles.field, styles.message]}
              value={message}
            />
            <View style={styles.actions}>
              <Pressable onPress={() => setOpen(false)} style={styles.cancel}>
                <Text style={styles.cancelText}>Quay lại</Text>
              </Pressable>
              <Pressable
                disabled={request.isPending}
                onPress={() => request.mutate()}
                style={[detailStyles.primaryButton, styles.send]}
              >
                <Text style={detailStyles.primaryButtonText}>Gửi yêu cầu</Text>
              </Pressable>
            </View>
            {request.isError ? (
              <Text style={styles.error}>Không thể gửi yêu cầu.</Text>
            ) : null}
          </View>
        </View>
      </Modal>
    </DetailPage>
  );
}

const styles = StyleSheet.create({
  author: { alignItems: "center", flexDirection: "row", gap: 10 },
  avatar: {
    alignItems: "center",
    backgroundColor: "#ddf4eb",
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  avatarText: { color: theme.colors.primary, fontSize: 20, fontWeight: "900" },
  authorName: { color: theme.colors.ink, fontSize: 16, fontWeight: "900" },
  badge: {
    backgroundColor: "#e5f6ef",
    borderRadius: 20,
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: "800",
    marginLeft: "auto",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  route: { backgroundColor: "#f1faf7", borderRadius: 14, padding: 15 },
  label: { color: "#83948f", fontSize: 11 },
  place: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 3,
  },
  arrow: {
    color: theme.colors.primary,
    fontSize: 21,
    fontWeight: "900",
    marginVertical: 4,
  },
  meta: {
    color: theme.colors.inkMuted,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  disabled: { backgroundColor: "#88aa9f" },
  overlay: {
    alignItems: "center",
    backgroundColor: "rgba(9,31,25,.55)",
    flex: 1,
    justifyContent: "center",
    padding: 18,
  },
  modal: {
    backgroundColor: "#fff",
    borderRadius: 24,
    gap: 13,
    padding: 20,
    width: "100%",
  },
  modalTitle: { color: theme.colors.ink, fontSize: 23, fontWeight: "900" },
  modalRoute: { backgroundColor: "#eff9f5", borderRadius: 14, padding: 14 },
  modalPlace: { color: theme.colors.ink, fontSize: 13, fontWeight: "700" },
  inputLabel: { color: theme.colors.ink, fontSize: 13, fontWeight: "800" },
  message: { minHeight: 100, textAlignVertical: "top" },
  actions: { flexDirection: "row", gap: 10 },
  cancel: {
    alignItems: "center",
    borderColor: theme.colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    padding: 14,
  },
  cancelText: { color: theme.colors.ink, fontWeight: "800" },
  send: { flex: 1 },
  error: { color: theme.colors.danger, fontSize: 12 },
});
