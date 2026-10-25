import { AppState, Linking, Platform } from "react-native";
import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import { router } from "expo-router";
import { DetailPage } from "@/components/DetailPage";
import { InfoPanel } from "@/components/InfoPanel";
import { Badge, Button, Card, ErrorText, Text, ui } from "@/components/ui";
export default function NotificationsSettings() {
  const canUseNotifications =
    Platform.OS !== "web" && Constants.executionEnvironment !== "storeClient";
  async function loadNotifications() {
    if (!canUseNotifications)
      throw new Error("Thông báo thiết bị cần bản cài Dike.");
    // Importing the package itself registers push listeners on Android.
    // Keep it out of Expo Go, including while Expo Router loads route modules.
    return import("expo-notifications");
  }
  const permission = useQuery({
    queryKey: ["mobile-notification-permission"],
    queryFn: async () => (await loadNotifications()).getPermissionsAsync(),
    enabled: canUseNotifications,
  });
  const enable = useMutation({
    mutationFn: async () => {
      const Notifications = await loadNotifications();
      if (Platform.OS === "android")
        await Notifications.setNotificationChannelAsync("journey", {
          name: "Cập nhật hành trình",
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      await Notifications.requestPermissionsAsync();
      await permission.refetch();
    },
  });
  const settings = useMutation({ mutationFn: () => Linking.openSettings() });
  useEffect(() => {
    if (!canUseNotifications) return;
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") void permission.refetch();
    });
    return () => listener.remove();
  }, [canUseNotifications, permission.refetch]);
  return (
    <DetailPage
      title="Cài đặt thông báo"
      subtitle="Không bỏ lỡ hành trình của bạn"
    >
      <InfoPanel
        icon="notifications-outline"
        title="Nhận tin theo cách của bạn"
        description="Quyền trên thiết bị và thông báo trong Dike được quản lý riêng."
      />
      <Card>
        <Text style={ui.sectionTitle}>Thông báo trên thiết bị</Text>
        {Constants.executionEnvironment === "storeClient" ? (
          <Text style={ui.muted}>
            Bạn vẫn xem được thông báo trong Dike. Quyền thông báo thiết bị cần
            mở bằng bản cài Dike development build.
          </Text>
        ) : null}
        {permission.data ? (
          <Badge
            label={permission.data.granted ? "Đã cho phép" : "Chưa cho phép"}
          />
        ) : null}
        <Text style={ui.muted}>
          Quyền hiển thị, âm thanh và thông báo trên màn hình khóa được quản lý
          trong cài đặt hệ thống của điện thoại.
        </Text>
        {canUseNotifications &&
        permission.data?.canAskAgain &&
        !permission.data.granted ? (
          <Button
            label="Cho phép thông báo"
            pending={enable.isPending}
            onPress={() => enable.mutate()}
          />
        ) : null}
        <ErrorText error={permission.error || enable.error || settings.error} />
        <Button
          label="Mở cài đặt thiết bị"
          icon="settings-outline"
          disabled={!canUseNotifications}
          pending={settings.isPending}
          onPress={() => settings.mutate()}
        />
      </Card>
      <Card>
        <Text style={ui.sectionTitle}>Trung tâm thông báo</Text>
        <Text style={ui.muted}>
          Yêu cầu kết nối, tin nhắn và cập nhật chuyến đi vẫn được lưu trong
          Dike.
        </Text>
        <Button
          label="Xem thông báo"
          variant="secondary"
          onPress={() => router.push("/notifications")}
        />
      </Card>
    </DetailPage>
  );
}
