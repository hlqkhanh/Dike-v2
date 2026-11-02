import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { useFonts } from "expo-font";
import { PlusJakartaSans_400Regular } from "@expo-google-fonts/plus-jakarta-sans/400Regular";
import { PlusJakartaSans_500Medium } from "@expo-google-fonts/plus-jakarta-sans/500Medium";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans/800ExtraBold";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { theme } from "@/core/theme";

import { SessionProvider, useSession } from "@/core/session";
import { SessionLoading } from "@/components/SessionLoading";

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    [theme.font.regular]: PlusJakartaSans_400Regular,
    [theme.font.medium]: PlusJakartaSans_500Medium,
    [theme.font.semibold]: PlusJakartaSans_600SemiBold,
    [theme.font.bold]: PlusJakartaSans_700Bold,
    [theme.font.heavy]: PlusJakartaSans_800ExtraBold,
    ...Ionicons.font,
  });
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, staleTime: 15_000 } },
      }),
  );
  if (!fontsLoaded && !fontError)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#ffffff",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator
          color="#087d61"
          accessibilityLabel="Đang khởi động Dike"
        />
      </View>
    );
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <StatusBar style="dark" />
          <SessionNavigator />
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function SessionNavigator() {
  const { session, loading } = useSession();
  const needsOnboarding = [
    "REVIEW_CONSENT",
    "SUBMIT_PHONE",
    "VERIFY_PHONE",
  ].includes(session?.user.nextAction ?? "");
  if (loading) return <SessionLoading />;
  return (
    <View style={{ flex: 1, backgroundColor: "#ffffff" }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#ffffff" },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="auth/callback" />
        <Stack.Protected guard={__DEV__}>
          <Stack.Screen name="ui-gallery" />
        </Stack.Protected>
        <Stack.Protected guard={!!session?.authenticated}>
          <Stack.Screen name="onboarding/phone" />
          <Stack.Screen name="settings/consent" />
          <Stack.Protected guard={!needsOnboarding}>
            {[
              "(tabs)",
              "booking/[id]",
              "chat/[id]",
              "create-trip",
              "onboarding/location",
              "notifications",
              "my-posts",
              "requests",
              "posts/[id]",
              "schedules",
              "schedules/edit",
              "settings",
              "settings/notifications",
              "settings/privacy",
              "settings/profile",
              "settings/security",
              "trip/[id]",
              "user/[id]",
              "verification",
            ].map((name) => (
              <Stack.Screen key={name} name={name} />
            ))}
          </Stack.Protected>
        </Stack.Protected>
      </Stack>
    </View>
  );
}
