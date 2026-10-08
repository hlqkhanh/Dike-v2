import { Pressable, StyleSheet, Text, View } from "react-native";

import { Screen, sharedStyles } from "@/components/Screen";
import { useSession } from "@/core/session";
import { theme } from "@/core/theme";

export default function Profile() {
  const { session, signOut } = useSession();
  const user = session?.user;
  return (
    <Screen subtitle="Hồ sơ và trạng thái quyền truy cập" title="Tài khoản">
      <View style={sharedStyles.card}>
        <Text style={sharedStyles.cardTitle}>
          {user?.displayName ?? "Thành viên Dike"}
        </Text>
        <Text style={sharedStyles.body}>{user?.email}</Text>
        <Text style={sharedStyles.body}>Chế độ: {user?.accessMode}</Text>
        <Text style={sharedStyles.body}>
          Điện thoại: {user?.phoneMasked || "Chưa cung cấp"}
        </Text>
      </View>
      {user?.accessMode === "SIMULATED" ? (
        <Text style={styles.warning}>
          Tài xế thử nghiệm · Số điện thoại chưa xác minh
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={() => void signOut()}
        style={styles.button}
      >
        <Text style={styles.buttonText}>Đăng xuất thiết bị này</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  warning: {
    backgroundColor: "#fff4ce",
    borderRadius: theme.radius.md,
    color: "#7a4d00",
    padding: theme.spacing.md,
  },
  button: {
    alignItems: "center",
    borderColor: theme.colors.danger,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    padding: theme.spacing.md,
  },
  buttonText: { color: theme.colors.danger, fontWeight: "700" },
});
