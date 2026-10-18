import { router } from "expo-router";
import type { PropsWithChildren } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "@/core/theme";

export function DetailPage({
  title,
  subtitle,
  loading,
  children,
}: PropsWithChildren<{ title: string; subtitle?: string; loading?: boolean }>) {
  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.top}>
          <Pressable
            accessibilityLabel="Quay lại"
            onPress={() => router.back()}
            style={styles.back}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <View style={styles.heading}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
        </View>
        {loading ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : (
          children
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export const detailStyles = StyleSheet.create({
  card: {
    ...theme.shadow.card,
    backgroundColor: "#fff",
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  eyebrow: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  heading: { color: theme.colors.ink, fontSize: 18, fontWeight: "900" },
  muted: { color: theme.colors.inkMuted, fontSize: 13, lineHeight: 19 },
  primaryButton: {
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    padding: 14,
  },
  primaryButtonText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  field: {
    backgroundColor: "#fff",
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    color: theme.colors.ink,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});

const styles = StyleSheet.create({
  safe: { backgroundColor: theme.colors.canvas, flex: 1 },
  content: { gap: 14, padding: 16, paddingBottom: 40 },
  top: { alignItems: "center", flexDirection: "row", gap: 12, marginBottom: 4 },
  back: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: theme.colors.border,
    borderRadius: 19,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  backText: { color: theme.colors.ink, fontSize: 28, lineHeight: 30 },
  heading: { flex: 1 },
  title: { color: theme.colors.ink, fontSize: 24, fontWeight: "900" },
  subtitle: { color: theme.colors.inkMuted, fontSize: 12, marginTop: 2 },
});
