import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { Image, StyleSheet, Text, View } from "react-native";
import type { ImageStyle } from "react-native";
import { DetailPage, detailStyles } from "@/components/DetailPage";
import { createMobileApi } from "@/core/api";
import { useSession } from "@/core/session";
import { theme } from "@/core/theme";
export default function UserProfile() {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const { token } = useSession();
  const query = useQuery({
    queryKey: ["mobile-user", id],
    queryFn: () =>
      createMobileApi(() => Promise.resolve(token)).userProfile(id),
    enabled: Boolean(id),
  });
  const user = query.data;
  return (
    <DetailPage
      loading={query.isLoading}
      subtitle="Hồ sơ thành viên Diké"
      title="Thông tin cá nhân"
    >
      {user ? (
        <>
          <View style={styles.hero}>
            {user.avatarUrl ? (
              <Image
                source={{ uri: user.avatarUrl }}
                style={styles.avatar as ImageStyle}
              />
            ) : (
              <View style={[styles.avatar, styles.fallback]}>
                <Text style={styles.initial}>{user.displayName.charAt(0)}</Text>
              </View>
            )}
            <Text style={styles.name}>{user.displayName}</Text>
            <Text style={styles.verified}>
              {user.verified ? "✓ Đã xác minh" : "Thành viên Diké"}
            </Text>
          </View>
          <View style={detailStyles.card}>
            <Text style={detailStyles.eyebrow}>GIỚI THIỆU</Text>
            <Text style={detailStyles.muted}>
              {user.bio || "Người dùng chưa cập nhật phần giới thiệu."}
            </Text>
          </View>
          <View style={detailStyles.primaryButton}>
            <Text style={detailStyles.primaryButtonText}>
              Bắt đầu trò chuyện
            </Text>
          </View>
        </>
      ) : null}
    </DetailPage>
  );
}
const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: 24,
    padding: 26,
  },
  avatar: {
    borderColor: "#fff",
    borderRadius: 44,
    borderWidth: 3,
    height: 88,
    width: 88,
  },
  fallback: {
    alignItems: "center",
    backgroundColor: "#ed3b78",
    justifyContent: "center",
  },
  initial: { color: "#fff", fontSize: 34, fontWeight: "800" },
  name: { color: "#fff", fontSize: 25, fontWeight: "900", marginTop: 12 },
  verified: { color: "#c9f3e4", fontSize: 12, marginTop: 5 },
});
