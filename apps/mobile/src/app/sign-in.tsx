import type { LocalPersona } from "@/core/api";
import { Redirect } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Text, Button, ErrorText, Icon, ui } from "@/components/ui";
import { homeAssets } from "@/core/assets";
import { useSession } from "@/core/session";
import { theme } from "@/core/theme";
export default function SignIn() {
  const {
    session,
    token: storedToken,
    sessionError,
    refresh,
    signInWithGoogle,
    signInLocally,
  } = useSession();
  const [error, setError] = useState<unknown>();
  const [pending, setPending] = useState(false);
  if (session?.authenticated) return <Redirect href="/(tabs)" />;
  async function submit(persona?: LocalPersona) {
    setPending(true);
    setError(undefined);
    try {
      if (persona) await signInLocally(persona);
      else await signInWithGoogle();
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  }
  return (
    <LinearGradient
      colors={["#ffffff", "#ffffff", "#ffffff"]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              flexGrow: 1,
              padding: 28,
              justifyContent: "center",
              gap: 24,
            }}
          >
            <View style={ui.row}>
              <View
                style={{
                  backgroundColor: "#e5f5eb",
                  borderRadius: 15,
                  padding: 12,
                }}
              >
                <Image
                  source={homeAssets.logo}
                  accessibilityLabel="Logo Diké"
                  style={{ width: 36, height: 36 }}
                />
              </View>
              <Text
                style={{ fontSize: 30, fontWeight: "800", letterSpacing: -1 }}
              >
                Diké
              </Text>
              <Text
                style={{
                  color: theme.colors.primary,
                  fontSize: 11,
                  letterSpacing: 2,
                }}
              >
                SHARE
              </Text>
            </View>
            <View style={{ paddingVertical: 20 }}>
              <Image
                accessible={false}
                source={homeAssets.homeLandscape}
                resizeMode="cover"
                style={{ width: "100%", height: 158, borderRadius: 26 }}
              />
            </View>
            <View style={{ gap: 14 }}>
              <Text style={ui.eyebrow}>MỖI CHUYẾN ĐI, THÊM MỘT KẾT NỐI</Text>
              <Text
                accessibilityRole="header"
                style={{
                  fontSize: 38,
                  lineHeight: 48,
                  fontWeight: "800",
                  letterSpacing: -1.5,
                }}
              >
                Đi chung, nhẹ{`\n`}đường hơn.
              </Text>
              <Text style={[ui.muted, { fontSize: 16 }]}>
                Kết nối những người cùng đường. Chia sẻ hành trình, tiết kiệm
                chi phí và cùng sống xanh.
              </Text>
            </View>
            <Button
              label="Đăng nhập bằng Google"
              icon="logo-google"
              pending={pending}
              onPress={() => void submit()}
            />
            {__DEV__ ? (
              <View style={{ gap: 8 }}>
                {(["member", "driver", "admin"] as const).map((persona) => (
                  <Button
                    key={persona}
                    label={`Local: ${persona}`}
                    variant="secondary"
                    disabled={pending}
                    onPress={() => void submit(persona)}
                  />
                ))}
              </View>
            ) : null}
            <ErrorText error={error || sessionError} />
            {storedToken && sessionError ? (
              <Button
                label="Thử kết nối lại"
                variant="secondary"
                onPress={() => void refresh()}
              />
            ) : null}
            <View style={[ui.row, { justifyContent: "center" }]}>
              <Icon name="shield-checkmark-outline" size={17} />
              <Text style={{ color: theme.colors.inkMuted, fontSize: 12 }}>
                Tài khoản của bạn được bảo vệ
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}
