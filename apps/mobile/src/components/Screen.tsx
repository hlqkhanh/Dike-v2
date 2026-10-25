import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Pressable,
  Image,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { PropsWithChildren } from "react";

import { theme } from "@/core/theme";
import { router } from "expo-router";
import { Text, Icon, LoadingCards } from "./ui";
import { ArtHeader } from "./ArtHeader";
import { homeAssets, type PageArt } from "@/core/assets";

type ScreenProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  art?: PageArt;
  hideHeader?: boolean;
  backgroundColor?: string;
}>;

export function Screen({
  title,
  subtitle,
  loading,
  refreshing,
  onRefresh,
  children,
  art,
  hideHeader,
  backgroundColor,
}: ScreenProps) {
  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.page, backgroundColor ? { backgroundColor } : null]}
    >
      <ScrollView
        style={backgroundColor ? { backgroundColor } : undefined}
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
            <Image
              source={homeAssets.logo}
              accessibilityLabel="Logo Diké"
              style={{ width: 38, height: 38 }}
            />
          </View>
          <Text style={styles.brandName}>Diké</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Thông báo"
            onPress={() => router.push("/notifications")}
            style={styles.notification}
          >
            <Icon name="notifications-outline" />
          </Pressable>
        </View>
        {hideHeader ? null : art ? (
          <ArtHeader title={title} subtitle={subtitle} art={art} />
        ) : (
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
        )}
        {loading ? <LoadingCards /> : children}
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
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  brandRow: {
    alignItems: "center",
    flexDirection: "row",
    paddingVertical: 14,
  },
  brandMark: {
    alignItems: "center",
    backgroundColor: "transparent",
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
    height: 48,
    justifyContent: "center",
    marginLeft: "auto",
    width: 48,
  },
  notificationText: { color: "#ef4444", fontSize: 10 },
  header: { gap: theme.spacing.xs, paddingBottom: 10, paddingTop: 4 },
  title: { color: theme.colors.ink, fontSize: 30, fontWeight: "900" },
  subtitle: { color: theme.colors.inkMuted, fontSize: 15, lineHeight: 22 },
});
