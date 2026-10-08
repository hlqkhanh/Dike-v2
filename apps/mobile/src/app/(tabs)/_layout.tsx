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
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Khám phá",
          tabBarIcon: ({ color }) => icon("⌕", color),
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: "Chuyến",
          tabBarIcon: ({ color }) => icon("↗", color),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Hộp thư",
          tabBarIcon: ({ color }) => icon("✉", color),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Tôi", tabBarIcon: ({ color }) => icon("●", color) }}
      />
    </Tabs>
  );
}
