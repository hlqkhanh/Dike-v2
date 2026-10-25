import { router, type Href } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { Pressable, View } from "react-native";
import type { MyProfileResponse } from "@dike/api-client-ts";
import { Screen } from "@/components/Screen";
import { ResourceState } from "@/components/ResourceState";
import { ProfileIdentity } from "@/components/ProfileIdentity";
import {
  Badge,
  Button,
  Card,
  ErrorText,
  Icon,
  Text,
  ui,
  type IconName,
} from "@/components/ui";
import { useResource } from "@/core/hooks";
import { useSession } from "@/core/session";
const links: { label: string; href: Href; icon: IconName }[] = [
  {
    label: "Chỉnh sửa hồ sơ",
    href: "/settings/profile",
    icon: "create-outline",
  },
  {
    label: "Lịch trình thường xuyên",
    href: "/schedules",
    icon: "calendar-outline",
  },
  {
    label: "Xác minh tài khoản",
    href: "/verification",
    icon: "shield-checkmark-outline",
  },
  {
    label: "Cài đặt và quyền riêng tư",
    href: "/settings",
    icon: "settings-outline",
  },
];
export default function Profile() {
  const { session, signOut } = useSession();
  const user = session?.user;
  const query = useResource<MyProfileResponse>("my-profile", "/me/profile");
  const out = useMutation({ mutationFn: signOut });
  return (
    <Screen
      title=""
      hideHeader
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching}
    >
      <ProfileIdentity name={user?.displayName} avatar={user?.avatarUrl}>
        <Badge
          label={
            user?.phoneStatus === "VERIFIED"
              ? "Điện thoại đã xác minh"
              : "Thành viên Dike"
          }
        />
        {user?.accessMode === "SIMULATED" ? (
          <Badge label="Quyền thử nghiệm" gold />
        ) : null}
      </ProfileIdentity>
      <ResourceState query={query}>
        <Card>
          <Text style={ui.eyebrow}>GIỚI THIỆU</Text>
          <Text style={ui.muted}>
            {query.data?.bio ||
              "Thêm một vài dòng về bạn để người cùng đường hiểu bạn hơn."}
          </Text>
          <View style={ui.row}>
            <Icon name="mail-outline" />
            <Text style={[ui.muted, { flex: 1 }]}>{user?.email}</Text>
          </View>
          <View style={ui.row}>
            <Icon name="call-outline" />
            <Text style={ui.muted}>
              {user?.phoneMasked || "Chưa thêm số điện thoại"}
            </Text>
          </View>
        </Card>
      </ResourceState>
      <Card>
        {links.map((item) => (
          <Pressable
            accessibilityRole="button"
            key={item.label}
            onPress={() => router.push(item.href)}
            style={[ui.row, { minHeight: 62 }]}
          >
            <Icon name={item.icon} />
            <Text style={{ flex: 1, fontWeight: "700", fontSize: 14 }}>
              {item.label}
            </Text>
            <Icon name="chevron-forward" size={18} />
          </Pressable>
        ))}
      </Card>
      <ErrorText error={out.error} />
      <Button
        label="Đăng xuất"
        icon="log-out-outline"
        variant="secondary"
        pending={out.isPending}
        onPress={() => out.mutate()}
      />
    </Screen>
  );
}
