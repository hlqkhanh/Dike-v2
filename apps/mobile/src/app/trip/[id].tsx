import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { DetailPage, detailStyles } from "@/components/DetailPage";
import { createMobileApi } from "@/core/api";
import { useSession } from "@/core/session";
import { theme } from "@/core/theme";

const stages = ["Đã xác nhận", "Đang đến đón", "Đã đến điểm đón", "Hoàn thành"];
export default function TripDetail() {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const { token } = useSession();
  const query = useQuery({
    queryKey: ["mobile-trip", id],
    queryFn: () => createMobileApi(() => Promise.resolve(token)).trip(id),
    enabled: Boolean(id),
    refetchInterval: 15_000,
  });
  const trip = query.data;
  const step =
    trip?.status === "COMPLETED" ? 4 : trip?.status === "ACTIVE" ? 2 : 1;
  return (
    <DetailPage
      loading={query.isLoading}
      subtitle="Theo dõi trạng thái theo thời gian thực"
      title="Chi tiết chuyến đi"
    >
      {trip ? (
        <>
          <View style={detailStyles.card}>
            <Text style={detailStyles.eyebrow}>TUYẾN ĐƯỜNG</Text>
            <View style={styles.route}>
              <Text style={styles.label}>Điểm đón</Text>
              <Text style={styles.place}>{trip.originLabel}</Text>
              <Text style={styles.arrow}>↓</Text>
              <Text style={styles.label}>Điểm đến</Text>
              <Text style={styles.place}>{trip.destinationLabel}</Text>
            </View>
            <Text style={detailStyles.muted}>
              ▣ {new Date(trip.departureAt).toLocaleString("vi-VN")} ·{" "}
              {trip.vehicleType === "CAR" ? "Ô tô" : "Xe máy"}
            </Text>
          </View>
          <View style={detailStyles.card}>
            <Text style={detailStyles.eyebrow}>TIẾN ĐỘ CHUYẾN ĐI</Text>
            {stages.map((label, index) => (
              <View key={label} style={styles.stage}>
                <View
                  style={[styles.stageDot, index < step && styles.stageDone]}
                >
                  <Text
                    style={[styles.check, index < step && styles.checkDone]}
                  >
                    {index < step ? "✓" : index + 1}
                  </Text>
                </View>
                <View style={styles.stageCopy}>
                  <Text
                    style={[
                      styles.stageLabel,
                      index < step && styles.stageLabelDone,
                    ]}
                  >
                    {label}
                  </Text>
                  {index < stages.length - 1 ? (
                    <View
                      style={[
                        styles.stageLine,
                        index + 1 < step && styles.stageLineDone,
                      ]}
                    />
                  ) : null}
                </View>
              </View>
            ))}
            <Text style={styles.notice}>
              Tiến độ được đồng bộ cho cả người chở và người đi ké.
            </Text>
          </View>
        </>
      ) : query.isError ? (
        <Text style={detailStyles.muted}>Không tải được chuyến đi.</Text>
      ) : null}
    </DetailPage>
  );
}
const styles = StyleSheet.create({
  route: { backgroundColor: "#f1faf7", borderRadius: 14, padding: 15 },
  label: { color: "#82948e", fontSize: 11 },
  place: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 3,
  },
  arrow: {
    color: theme.colors.primary,
    fontSize: 20,
    fontWeight: "900",
    marginVertical: 5,
  },
  stage: { flexDirection: "row", gap: 12 },
  stageDot: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#cbded7",
    borderRadius: 16,
    borderWidth: 2,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  stageDone: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  check: { color: "#8aa098", fontSize: 11, fontWeight: "800" },
  checkDone: { color: "#fff" },
  stageCopy: { flex: 1 },
  stageLabel: {
    color: "#84968f",
    fontSize: 14,
    fontWeight: "700",
    paddingTop: 6,
  },
  stageLabelDone: { color: theme.colors.primary },
  stageLine: {
    backgroundColor: "#d9e7e2",
    height: 24,
    marginLeft: -28,
    marginTop: 8,
    width: 2,
  },
  stageLineDone: { backgroundColor: theme.colors.primary },
  notice: {
    backgroundColor: "#edf8f4",
    borderRadius: 11,
    color: "#52766b",
    fontSize: 11,
    marginTop: 2,
    padding: 11,
  },
});
