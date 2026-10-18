import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { DetailPage, detailStyles } from "@/components/DetailPage";
import { theme } from "@/core/theme";
export default function CreateTrip() {
  const [mode, setMode] = useState<"driver" | "passenger">("driver");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const ready = origin.trim() && destination.trim();
  return (
    <DetailPage
      subtitle="Nhập thông tin trên cùng một biểu mẫu"
      title="Tạo chuyến đi"
    >
      <View style={styles.mode}>
        {(["driver", "passenger"] as const).map((value) => (
          <Pressable
            key={value}
            onPress={() => setMode(value)}
            style={[styles.modeButton, mode === value && styles.modeActive]}
          >
            <Text
              style={[styles.modeText, mode === value && styles.modeTextActive]}
            >
              {value === "driver" ? "Tôi chở" : "Tôi đi ké"}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={detailStyles.card}>
        <Text style={detailStyles.eyebrow}>THÔNG TIN CHUYẾN ĐI</Text>
        <Text style={styles.label}>Điểm đi</Text>
        <TextInput
          onChangeText={setOrigin}
          placeholder="Nhập địa chỉ chi tiết"
          style={detailStyles.field}
          value={origin}
        />
        <Text style={styles.swap}>⇅</Text>
        <Text style={styles.label}>Điểm đến</Text>
        <TextInput
          onChangeText={setDestination}
          placeholder="Nhập địa chỉ chi tiết"
          style={detailStyles.field}
          value={destination}
        />
        <View style={styles.row}>
          <View style={styles.vehicle}>
            <Text style={styles.vehicleIcon}>🏍</Text>
            <Text style={styles.vehicleText}>Xe máy</Text>
          </View>
          <View style={styles.vehicle}>
            <Text style={styles.vehicleIcon}>🚗</Text>
            <Text style={styles.vehicleText}>Ô tô</Text>
          </View>
        </View>
        <Text style={styles.label}>Thời gian khởi hành</Text>
        <TextInput
          placeholder="DD/MM/YYYY · HH:mm"
          style={detailStyles.field}
        />
      </View>
      {ready ? (
        <View style={styles.preview}>
          <Text style={detailStyles.eyebrow}>TUYẾN ĐÃ NHẬP</Text>
          <Text style={styles.previewText}>{origin}</Text>
          <Text style={styles.previewArrow}>↓</Text>
          <Text style={styles.previewText}>{destination}</Text>
        </View>
      ) : null}
      <Pressable
        disabled={!ready}
        style={[detailStyles.primaryButton, !ready && styles.disabled]}
      >
        <Text style={detailStyles.primaryButtonText}>
          {ready ? "Tính tuyến đường" : "Nhập điểm đi và điểm đến"}
        </Text>
      </Pressable>
    </DetailPage>
  );
}
const styles = StyleSheet.create({
  mode: {
    backgroundColor: "#e8f4ef",
    borderRadius: 16,
    flexDirection: "row",
    padding: 4,
  },
  modeButton: { alignItems: "center", borderRadius: 13, flex: 1, padding: 11 },
  modeActive: { backgroundColor: theme.colors.primary },
  modeText: { color: theme.colors.inkMuted, fontWeight: "800" },
  modeTextActive: { color: "#fff" },
  label: { color: theme.colors.ink, fontSize: 12, fontWeight: "800" },
  swap: {
    alignSelf: "flex-end",
    color: theme.colors.primary,
    fontSize: 22,
    fontWeight: "900",
  },
  row: { flexDirection: "row", gap: 10 },
  vehicle: {
    alignItems: "center",
    borderColor: theme.colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    gap: 5,
    padding: 13,
  },
  vehicleIcon: { fontSize: 23 },
  vehicleText: { color: theme.colors.ink, fontSize: 12, fontWeight: "800" },
  preview: {
    ...theme.shadow.card,
    backgroundColor: "#fff",
    borderColor: theme.colors.border,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  previewText: { color: theme.colors.ink, fontSize: 13, fontWeight: "800" },
  previewArrow: {
    color: theme.colors.primary,
    fontSize: 20,
    fontWeight: "900",
    marginVertical: 4,
  },
  disabled: { backgroundColor: "#9eb9b0" },
});
