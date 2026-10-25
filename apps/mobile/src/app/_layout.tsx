import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { useFonts } from "expo-font";
import { PlusJakartaSans_400Regular } from "@expo-google-fonts/plus-jakarta-sans/400Regular";
import { PlusJakartaSans_500Medium } from "@expo-google-fonts/plus-jakarta-sans/500Medium";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans/800ExtraBold";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { SessionProvider, useSession } from "@/core/session";
import { SessionLoading } from "@/components/SessionLoading";

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Jakarta: PlusJakartaSans_400Regular,
    JakartaMedium: PlusJakartaSans_500Medium,
    JakartaBold: PlusJakartaSans_700Bold,
    JakartaExtraBold: PlusJakartaSans_800ExtraBold,
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
          backgroundColor: "#f3faf7",
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
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
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
