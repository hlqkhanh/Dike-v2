import { router } from "expo-router";
import { useEffect, useRef, type PropsWithChildren } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  RefreshControl,
  View,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "@/core/theme";
import { useReducedMotion } from "@/core/accessibility";
import { Text, Icon, LoadingCards } from "./ui";
import { ArtHeader } from "./ArtHeader";
import type { PageArt } from "@/core/assets";

export function DetailPage({
  title,
  subtitle,
  loading,
  children,
  onRefresh,
  refreshing,
  art,
  backgroundColor,
}: PropsWithChildren<{
  title: string;
  subtitle?: string;
  loading?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  art?: PageArt;
  backgroundColor?: string;
}>) {
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (Platform.OS !== "android") return;
    let pending: ReturnType<typeof setTimeout> | undefined;
    const subscription = Keyboard.addListener("keyboardDidShow", (event) => {
      clearTimeout(pending);
      // Measure after Android has resized the scroll viewport.
      pending = setTimeout(() => {
        TextInput.State.currentlyFocusedInput()?.measureInWindow(
          (_x, y, _width, height) => {
            const overlap = y + height + 24 - event.endCoordinates.screenY;
            if (overlap > 0) {
              scrollRef.current?.scrollTo({
                y: scrollOffset.current + overlap,
                animated: !reducedMotion,
              });
            }
          },
        );
      }, 100);
    });
    const hidden = Keyboard.addListener("keyboardDidHide", () =>
      clearTimeout(pending),
    );
    return () => {
      clearTimeout(pending);
      subscription.remove();
      hidden.remove();
    };
  }, [reducedMotion]);
  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={[styles.safe, backgroundColor ? { backgroundColor } : null]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          ref={scrollRef}
          onScroll={(event) => {
            scrollOffset.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={!!refreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.primary}
              />
            ) : undefined
          }
        >
          <View style={styles.top}>
            <Pressable
              accessibilityLabel="Quay lại"
              accessibilityRole="button"
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace("/(tabs)")
              }
              style={styles.back}
            >
              <Icon name="arrow-back" />
            </Pressable>
            <View style={styles.heading}>
              <Text
                accessibilityRole="header"
                style={[styles.title, art ? { fontSize: 16 } : null]}
              >
                {art ? "Hành trình cùng Diké" : title}
              </Text>
              {subtitle && !art ? (
                <Text style={styles.subtitle}>{subtitle}</Text>
              ) : null}
            </View>
          </View>
          {art ? (
            <ArtHeader title={title} subtitle={subtitle} art={art} />
          ) : null}
          {loading ? <LoadingCards /> : children}
        </ScrollView>
      </KeyboardAvoidingView>
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
  content: { gap: 18, padding: 20, paddingBottom: 40 },
  top: { alignItems: "center", flexDirection: "row", gap: 12, marginBottom: 4 },
  back: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: theme.colors.border,
    borderRadius: 19,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  backText: { color: theme.colors.ink, fontSize: 28, lineHeight: 30 },
  heading: { flex: 1 },
  title: { color: theme.colors.ink, fontSize: 24, fontWeight: "900" },
  subtitle: { color: theme.colors.inkMuted, fontSize: 12, marginTop: 2 },
});
