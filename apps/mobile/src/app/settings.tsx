import { router, type Href } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { Pressable, View } from "react-native";
import { DetailPage } from "@/components/DetailPage";
import {
  Button,
  Card,
  ErrorText,
  Icon,
  Text,
  ui,
  type IconName,
} from "@/components/ui";
import { useSession } from "@/core/session";
const items: { title: string; text: string; icon: IconName; href: Href }[] = [
  {
    title: "Thông tin cá nhân",
    text: "Tên hiển thị và giới thiệu",
    icon: "person-outline",
    href: "/settings/profile",
  },
  {
    title: "Lịch trình thường xuyên",
    text: "Quản lý các tuyến đường bạn hay di chuyển",
    icon: "calendar-outline",
    href: "/schedules",
  },
  {
    title: "Quyền riêng tư",
    text: "Ai có thể tìm và liên hệ với bạn",
    icon: "lock-closed-outline",
    href: "/settings/privacy",
  },
  {
    title: "Xác minh tài khoản",
    text: "Điện thoại và quyền truy cập",
    icon: "shield-checkmark-outline",
    href: "/verification",
  },
  {
    title: "Thông báo",
    text: "Quyền thông báo trên thiết bị",
    icon: "notifications-outline",
    href: "/settings/notifications",
  },
  {
    title: "Điều khoản và đồng ý",
    text: "Tài liệu và lịch sử chấp thuận",
    icon: "document-text-outline",
    href: "/settings/consent",
  },
  {
    title: "Bảo mật và thiết bị",
    text: "Quản lý các phiên đăng nhập",
    icon: "key-outline",
    href: "/settings/security",
  },
];
export default function Settings() {
  const { signOut } = useSession();
  const out = useMutation({ mutationFn: signOut });
  return (
    <DetailPage
      title="Cài đặt"
      subtitle="Quản lý hồ sơ và trải nghiệm Diké của bạn"
    >
      {[
        { title: "HỒ SƠ VÀ HÀNH TRÌNH", rows: items.slice(0, 2) },
        { title: "TÀI KHOẢN VÀ QUYỀN RIÊNG TƯ", rows: items.slice(2, 4) },
        { title: "ỨNG DỤNG VÀ BẢO MẬT", rows: items.slice(4) },
      ].map((group) => (
        <View key={group.title} style={{ gap: 12 }}>
          <Text style={[ui.eyebrow, { paddingHorizontal: 4 }]}>
            {group.title}
          </Text>
          <Card>
            {group.rows.map((item, i) => (
              <Pressable
                key={item.title}
                accessibilityRole="button"
                onPress={() => router.push(item.href)}
                style={[
                  ui.row,
                  {
                    minHeight: 76,
                    borderBottomWidth: i === group.rows.length - 1 ? 0 : 1,
                    borderBottomColor: "#edf4ef",
                    paddingVertical: 12,
                  },
                ]}
              >
                <View style={ui.emptyIcon}>
                  <Icon name={item.icon} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700" }}>
                    {item.title}
                  </Text>
                  <Text style={ui.muted}>{item.text}</Text>
                </View>
                <Icon name="chevron-forward" size={18} />
              </Pressable>
            ))}
          </Card>
        </View>
      ))}
      <ErrorText error={out.error} />
      <Button
        label="Đăng xuất"
        icon="log-out-outline"
        variant="secondary"
        pending={out.isPending}
        onPress={() => out.mutate()}
      />
    </DetailPage>
  );
}
