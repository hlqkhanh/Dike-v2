import { StyleSheet, Text, View } from "react-native";
import { DetailPage, detailStyles } from "@/components/DetailPage";
import { useSession } from "@/core/session";
import { theme } from "@/core/theme";
export default function Verification() {
  const user = useSession().session?.user;
  const items = [
    { title: "Google", state: "Đã liên kết", done: true },
    {
      title: "Số điện thoại",
      state: user?.phoneStatus === "VERIFIED" ? "Đã xác minh" : "Chưa xác minh",
      done: user?.phoneStatus === "VERIFIED",
    },
    { title: "eKYC", state: "Tạm hoãn", done: false },
    {
      title: "Quyền tài xế",
      state: user?.driverApprovalEvidence ? "Đã xác minh" : "Chưa xác minh",
      done: Boolean(user?.driverApprovalEvidence),
    },
    { title: "Phương tiện", state: "Kiểm tra phương tiện", done: false },
  ];
  const done = items.filter((item) => item.done).length;
  return (
    <DetailPage
      subtitle="Kiểm tra mức xác minh và quyền hiện tại"
      title="Xác minh"
    >
      <View style={styles.progress}>
        <Text style={detailStyles.heading}>
          Tiến độ thiết lập {done}/5 bước
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${done * 20}%` }]} />
        </View>
        <Text style={detailStyles.muted}>
          Hoàn thiện hồ sơ giúp cộng đồng tin tưởng và kết nối an toàn hơn.
        </Text>
      </View>
      {items.map((item) => (
        <View key={item.title} style={detailStyles.card}>
          <View style={styles.row}>
            <View style={styles.icon}>
              <Text style={styles.iconText}>{item.done ? "✓" : "○"}</Text>
            </View>
            <View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={[styles.state, item.done && styles.done]}>
                {item.state}
              </Text>
            </View>
          </View>
        </View>
      ))}
    </DetailPage>
  );
}
const styles = StyleSheet.create({
  progress: {
    ...theme.shadow.card,
    backgroundColor: "#fff",
    borderColor: theme.colors.border,
    borderRadius: 19,
    borderWidth: 1,
    gap: 12,
    padding: 17,
  },
  track: {
    backgroundColor: "#dcebe5",
    borderRadius: 4,
    height: 8,
    overflow: "hidden",
  },
  fill: { backgroundColor: theme.colors.primary, borderRadius: 4, height: 8 },
  row: { alignItems: "center", flexDirection: "row", gap: 12 },
  icon: {
    alignItems: "center",
    backgroundColor: "#e5f6ef",
    borderRadius: 14,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  iconText: { color: theme.colors.primary, fontSize: 20, fontWeight: "900" },
  title: { color: theme.colors.ink, fontSize: 15, fontWeight: "800" },
  state: { color: "#a06f08", fontSize: 12, marginTop: 3 },
  done: { color: theme.colors.primary },
});
