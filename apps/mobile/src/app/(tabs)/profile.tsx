import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { ImageStyle } from "react-native";
import { Link } from "expo-router";

import { Screen, sharedStyles } from "@/components/Screen";
import { useSession } from "@/core/session";
import { theme } from "@/core/theme";

export default function Profile() {
  const { session, signOut } = useSession();
  const user = session?.user;
  return (
    <Screen
      subtitle="Cùng cộng đồng tạo nên những hành trình xanh hơn"
      title="Cá nhân"
    >
      <View style={styles.hero}>
        {user?.avatarUrl ? (
          <Image
            source={{ uri: user.avatarUrl }}
            style={styles.avatar as ImageStyle}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarText}>
              {user?.displayName?.charAt(0).toUpperCase() || "D"}
            </Text>
          </View>
        )}
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>HỒ SƠ DIKÉ SHARE</Text>
          <Text style={styles.name}>
            {user?.displayName ?? "Thành viên Diké"}
          </Text>
          <View style={styles.memberBadge}>
            <Text style={styles.memberBadgeText}>
              ● Thành viên đang hoạt động
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Thông tin cá nhân</Text>
      <View style={sharedStyles.card}>
        <Info icon="✉" label="Email" value={user?.email || "Chưa cung cấp"} />
        <View style={styles.divider} />
        <Info
          icon="☎"
          label="Số điện thoại"
          value={user?.phoneMasked || "Chưa cung cấp"}
        />
      </View>

      <Text style={styles.sectionTitle}>Trạng thái tài khoản</Text>
      <View style={sharedStyles.card}>
        <Info
          icon="✓"
          label="Xác minh"
          value={verificationLabel(user?.phoneStatus)}
        />
        <View style={styles.divider} />
        <Info
          icon="⚿"
          label="Quyền truy cập"
          value={
            user?.accessMode === "SIMULATED"
              ? "Môi trường thử nghiệm"
              : "Tài khoản chính thức"
          }
        />
      </View>

      {user?.accessMode === "SIMULATED" ? (
        <Text style={styles.warning}>
          Quyền thử nghiệm đang được sử dụng trên môi trường phát triển.
        </Text>
      ) : null}
      <View style={styles.quickLinks}>
        {(
          [
            ["Thông báo", "/notifications"],
            ["Lịch trình", "/schedules"],
            ["Cài đặt", "/settings"],
          ] as const
        ).map(([label, href]) => (
          <Link asChild href={href} key={href}>
            <Pressable style={styles.quickLink}>
              <Text style={styles.quickLinkText}>{label}</Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          </Link>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => void signOut()}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.buttonText}>Đăng xuất thiết bị này</Text>
      </Pressable>
    </Screen>
  );
}

function Info({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.info}>
      <View style={styles.infoIcon}>
        <Text style={styles.infoIconText}>{icon}</Text>
      </View>
      <View style={styles.infoCopy}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </View>
  );
}

function verificationLabel(status?: string) {
  if (status === "VERIFIED") return "Đã xác minh";
  if (status === "PENDING") return "Đang chờ xác minh";
  return "Chưa xác minh";
}

const styles = StyleSheet.create({
  hero: {
    ...theme.shadow.card,
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.xl,
    flexDirection: "row",
    minHeight: 150,
    overflow: "hidden",
    padding: 20,
  },
  avatar: {
    borderColor: "rgba(255,255,255,.75)",
    borderRadius: 38,
    borderWidth: 3,
    height: 76,
    width: 76,
  },
  avatarFallback: {
    alignItems: "center",
    backgroundColor: "#ed3b78",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 30, fontWeight: "800" },
  heroCopy: { flex: 1, marginLeft: 16 },
  eyebrow: {
    color: "#bdebdc",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  name: { color: "#fff", fontSize: 25, fontWeight: "900", marginTop: 5 },
  memberBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,.15)",
    borderRadius: theme.radius.pill,
    marginTop: 9,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  memberBadgeText: { color: "#e8fff7", fontSize: 10, fontWeight: "700" },
  sectionTitle: {
    color: theme.colors.ink,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 6,
  },
  info: { alignItems: "center", flexDirection: "row", gap: 12 },
  infoIcon: {
    alignItems: "center",
    backgroundColor: "#e4f6ef",
    borderRadius: 12,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  infoIconText: {
    color: theme.colors.primary,
    fontSize: 17,
    fontWeight: "900",
  },
  infoCopy: { flex: 1 },
  infoLabel: { color: "#81938d", fontSize: 11 },
  infoValue: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },
  chevron: { color: "#789087", fontSize: 25 },
  divider: { backgroundColor: "#e8efec", height: 1 },
  quickLinks: { gap: 9 },
  quickLink: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 15,
  },
  quickLinkText: { color: theme.colors.ink, fontSize: 14, fontWeight: "800" },
  warning: {
    backgroundColor: "#fff4ce",
    borderColor: "#efd68e",
    borderRadius: theme.radius.md,
    borderWidth: 1,
    color: "#7a4d00",
    padding: theme.spacing.md,
  },
  button: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: theme.colors.danger,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    padding: theme.spacing.md,
  },
  pressed: { opacity: 0.8 },
  buttonText: { color: theme.colors.danger, fontWeight: "700" },
});
