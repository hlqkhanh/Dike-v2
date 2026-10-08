import { Redirect } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { API_BASE_URL } from "@/core/api";
import { useSession } from "@/core/session";
import { theme } from "@/core/theme";

export default function SignIn() {
  const { session, signInWithToken } = useSession();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  if (session?.authenticated) return <Redirect href="/(tabs)" />;

  const submit = async () => {
    setPending(true);
    setError("");
    try {
      await signInWithToken(token);
    } catch {
      setError("Token không hợp lệ hoặc API chưa sẵn sàng.");
    } finally {
      setPending(false);
    }
  };

  return (
    <View style={styles.page}>
      <Text accessibilityRole="header" style={styles.brand}>
        Dike
      </Text>
      <Text style={styles.title}>Đi chung, nhẹ đường hơn.</Text>
      <Text style={styles.body}>
        Mobile session exchange với Google sẽ dùng Development Build. Trong
        local, nhập opaque token do backend cấp để kiểm thử.
      </Text>
      <TextInput
        accessibilityLabel="Opaque mobile token"
        autoCapitalize="none"
        onChangeText={setToken}
        placeholder="Opaque mobile token"
        secureTextEntry
        style={styles.input}
        value={token}
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        disabled={!token.trim() || pending}
        onPress={submit}
        style={({ pressed }) => [
          styles.button,
          (!token.trim() || pending) && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.buttonText}>
          {pending ? "Đang xác thực…" : "Tiếp tục"}
        </Text>
      </Pressable>
      <Text style={styles.endpoint}>API: {API_BASE_URL}</Text>
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
  input: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    color: theme.colors.ink,
    padding: theme.spacing.md,
  },
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
