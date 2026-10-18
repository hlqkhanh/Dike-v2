import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { DetailPage, detailStyles } from "@/components/DetailPage";
import { theme } from "@/core/theme";
const sections = [
  { icon: "♙", title: "Tài khoản", text: "Thông tin cá nhân và liên hệ" },
  { icon: "◉", title: "Quyền riêng tư", text: "Hiển thị hồ sơ và tin nhắn" },
  {
    icon: "✓",
    title: "Xác minh",
    text: "Trạng thái tài khoản",
    href: "/verification" as const,
  },
  { icon: "▤", title: "Tài liệu", text: "Điều khoản và sự đồng ý" },
  { icon: "⚿", title: "Bảo mật", text: "Phiên đăng nhập và thiết bị" },
];
export default function Settings() {
  return (
    <DetailPage subtitle="Quản lý mọi thiết lập tại một nơi" title="Cài đặt">
      {sections.map((item) =>
        item.href ? (
          <Link asChild href={item.href} key={item.title}>
            <Pressable style={styles.row}>
              <Content {...item} />
            </Pressable>
          </Link>
        ) : (
          <View key={item.title} style={styles.row}>
            <Content {...item} />
          </View>
        ),
      )}
    </DetailPage>
  );
}
function Content({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <>
      <View style={styles.icon}>
        <Text style={styles.iconText}>{icon}</Text>
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={detailStyles.muted}>{text}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </>
  );
}
const styles = StyleSheet.create({
  row: {
    ...theme.shadow.card,
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: theme.colors.border,
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 15,
  },
  icon: {
    alignItems: "center",
    backgroundColor: "#e5f6ef",
    borderRadius: 13,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  iconText: { color: theme.colors.primary, fontSize: 18, fontWeight: "900" },
  copy: { flex: 1 },
  title: { color: theme.colors.ink, fontSize: 15, fontWeight: "800" },
  chevron: { color: "#789087", fontSize: 26 },
});
