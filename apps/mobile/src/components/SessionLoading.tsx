import { ActivityIndicator, Image, StyleSheet, View } from "react-native";
import { homeAssets } from "@/core/assets";
import { Text } from "./ui";

export function SessionLoading() {
  return (
    <View style={styles.page}>
      <View style={styles.brand}>
        <Image
          accessible={false}
          source={homeAssets.logo}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.name}>Diké</Text>
      </View>
      <Text style={styles.message}>Đang chuẩn bị hành trình của bạn</Text>
      <ActivityIndicator
        color="#087d61"
        accessibilityLabel="Đang khôi phục phiên đăng nhập"
      />
    </View>
  );
}
const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3faf7",
    gap: 22,
    padding: 24,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 12 },
  logo: { width: 56, height: 56 },
  name: { fontSize: 36, fontWeight: "800", letterSpacing: -1.5 },
  message: { fontSize: 14, color: "#526e62", textAlign: "center" },
});
