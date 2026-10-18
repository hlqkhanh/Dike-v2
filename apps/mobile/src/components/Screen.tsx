import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { PropsWithChildren } from "react";

import { theme } from "@/core/theme";

type ScreenProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}>;

export function Screen({
  title,
  subtitle,
  loading,
  refreshing,
  onRefresh,
  children,
}: ScreenProps) {
  return (
    <SafeAreaView edges={["top"]} style={styles.page}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              colors={[theme.colors.primary]}
              refreshing={Boolean(refreshing)}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
            />
          ) : undefined
        }
      >
        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>Di</Text>
          </View>
          <Text style={styles.brandName}>Diké</Text>
          <View style={styles.notification}>
            <Text style={styles.notificationText}>●</Text>
          </View>
        </View>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {loading ? (
          <ActivityIndicator
            accessibilityLabel="Đang tải"
            color={theme.colors.primary}
          />
        ) : (
          children
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export const sharedStyles = StyleSheet.create({
  card: {
    ...theme.shadow.card,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  cardTitle: { color: theme.colors.ink, fontSize: 17, fontWeight: "700" },
  body: { color: theme.colors.inkMuted, fontSize: 15, lineHeight: 22 },
  empty: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.md,
    color: theme.colors.inkMuted,
    padding: theme.spacing.lg,
    textAlign: "center",
  },
});

const styles = StyleSheet.create({
  page: { backgroundColor: theme.colors.canvas, flex: 1 },
  content: {
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: 44,
  },
  brandRow: {
    alignItems: "center",
    flexDirection: "row",
    paddingVertical: 14,
  },
  brandMark: {
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  brandMarkText: { color: "#fff", fontSize: 17, fontWeight: "900" },
  brandName: {
    color: theme.colors.ink,
    fontSize: 23,
    fontWeight: "900",
    marginLeft: 8,
  },
  notification: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: theme.colors.border,
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    marginLeft: "auto",
    width: 36,
  },
  notificationText: { color: "#ef4444", fontSize: 10 },
  header: { gap: theme.spacing.xs, paddingBottom: 10, paddingTop: 4 },
  title: { color: theme.colors.ink, fontSize: 30, fontWeight: "900" },
  subtitle: { color: theme.colors.inkMuted, fontSize: 15, lineHeight: 22 },
});
