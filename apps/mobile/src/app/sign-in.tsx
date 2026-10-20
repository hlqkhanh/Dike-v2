import { Redirect } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { API_BASE_URL, MobileApiError, type LocalPersona } from "@/core/api";
import { useSession } from "@/core/session";
import { theme } from "@/core/theme";

const personas: { value: LocalPersona; label: string }[] = [
  { value: "member", label: "Thành viên" },
  { value: "driver", label: "Tài xế" },
  { value: "admin", label: "Quản trị viên" },
];

export default function SignIn() {
  const { session, signInLocally } = useSession();
  const [error, setError] = useState("");
  const [pending, setPending] = useState<LocalPersona | null>(null);
  if (session?.authenticated) return <Redirect href="/(tabs)" />;

  const submit = async (persona: LocalPersona) => {
    if (pending) return;
    setPending(persona);
    setError("");
    try {
      await signInLocally(persona);
    } catch (cause) {
      setError(
        cause instanceof MobileApiError
          ? cause.status === 404 || cause.status === 401
            ? "Backend chưa bật đăng nhập local. Hãy chạy API với cấu hình local."
            : cause.message
          : "Không thể đăng nhập. Kiểm tra kết nối đến API rồi thử lại.",
      );
    } finally {
      setPending(null);
    }
  };

  return (
    <View style={styles.page}>
      <Text accessibilityRole="header" style={styles.brand}>
        Dike
      </Text>
      <Text style={styles.title}>Đi chung, nhẹ đường hơn.</Text>
      <Text style={styles.body}>
        {__DEV__
          ? "Chọn tài khoản thử nghiệm để khám phá Dike. Chỉ dùng trong môi trường local."
          : "Đăng nhập Google cho bản phát hành đang được hoàn thiện."}
      </Text>
      {__DEV__ &&
        personas.map((persona) => (
          <Pressable
            key={persona.value}
            accessibilityRole="button"
            accessibilityLabel={`Đăng nhập ${persona.label}`}
            disabled={pending !== null}
            onPress={() => void submit(persona.value)}
            style={({ pressed }) => [
              styles.button,
              pending !== null && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.buttonText}>
              {pending === persona.value ? "Đang đăng nhập…" : persona.label}
            </Text>
          </Pressable>
        ))}
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {__DEV__ && <Text style={styles.endpoint}>API: {API_BASE_URL}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: theme.colors.canvas,
    flex: 1,
    gap: theme.spacing.md,
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  brand: { color: theme.colors.primary, fontSize: 22, fontWeight: "800" },
  title: {
    color: theme.colors.ink,
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 40,
  },
  body: { color: theme.colors.inkMuted, fontSize: 16, lineHeight: 24 },
  button: {
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  buttonText: { color: "#ffffff", fontSize: 16, fontWeight: "800" },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
  error: { color: theme.colors.danger },
  endpoint: { color: theme.colors.inkMuted, fontSize: 12 },
});
