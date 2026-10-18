import { Redirect, Tabs } from "expo-router";
import { Text, type ColorValue } from "react-native";

import { useSession } from "@/core/session";
import { theme } from "@/core/theme";

const icon = (value: string, color: ColorValue) => (
  <Text style={{ color, fontSize: 18 }}>{value}</Text>
);

export default function TabsLayout() {
  const { loading, session } = useSession();
  if (!loading && !session?.authenticated) return <Redirect href="/sign-in" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.inkMuted,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#dcebe5",
          height: 68,
          paddingBottom: 8,
          paddingTop: 7,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Trang chủ",
          tabBarIcon: ({ color }) => icon("⌂", color),
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: "Chuyến đi",
          tabBarIcon: ({ color }) => icon("⇢", color),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Bạn bè",
          tabBarIcon: ({ color }) => icon("♧", color),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Tôi", tabBarIcon: ({ color }) => icon("●", color) }}
      />
    </Tabs>
  );
}
