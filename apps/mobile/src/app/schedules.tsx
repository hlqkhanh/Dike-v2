import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { DetailPage, detailStyles } from "@/components/DetailPage";
import { createMobileApi } from "@/core/api";
import { useSession } from "@/core/session";
import { theme } from "@/core/theme";
export default function Schedules() {
  const { token } = useSession();
  const query = useQuery({
    queryKey: ["mobile-schedules"],
    queryFn: () => createMobileApi(() => Promise.resolve(token)).schedules(),
  });
  return (
    <DetailPage
      loading={query.isLoading}
      subtitle="Các hành trình thường xuyên của bạn"
      title="Lịch trình của tôi"
    >
      {(query.data ?? []).map((item) => (
        <View key={item.id} style={styles.item}>
          <View style={styles.date}>
            <Text style={styles.dateText}>{item.weekdays?.length ?? 0}</Text>
            <Text style={styles.dateLabel}>ngày/tuần</Text>
          </View>
          <View style={styles.copy}>
            <Text numberOfLines={1} style={styles.route}>
              {item.usualOrigin.displayLabel}
            </Text>
            <Text style={styles.arrow}>↓</Text>
            <Text numberOfLines={1} style={styles.route}>
              {item.activityPlace.displayLabel}
            </Text>
            <Text style={detailStyles.muted}>
              {item.status} · {item.defaultTravelRole}
            </Text>
          </View>
        </View>
      ))}
      {query.data?.length === 0 ? (
        <Text style={detailStyles.muted}>
          Bạn chưa lưu lịch trình thường xuyên.
        </Text>
      ) : null}
    </DetailPage>
  );
}
const styles = StyleSheet.create({
  item: {
    ...theme.shadow.card,
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: theme.colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 13,
    padding: 14,
  },
  date: {
    alignItems: "center",
    backgroundColor: "#e8f7f1",
    borderRadius: 14,
    padding: 11,
  },
  dateText: { color: theme.colors.primary, fontSize: 20, fontWeight: "900" },
  dateLabel: { color: "#608076", fontSize: 9 },
  copy: { flex: 1 },
  route: { color: theme.colors.ink, fontSize: 13, fontWeight: "800" },
  arrow: { color: theme.colors.primary, fontWeight: "900", marginVertical: 2 },
});
