import { Pressable, StyleSheet, View } from "react-native";
import { theme } from "@/core/theme";
import { Icon, Text } from "./ui";

export function JourneyHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Quay lại"
        onPress={onBack}
        style={styles.back}
      >
        <Icon name="arrow-back" />
      </Pressable>
      <View style={styles.copy}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: theme.spacing.sm,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
  },
  back: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, gap: theme.spacing.xs, paddingEnd: theme.spacing.md },
  title: { fontSize: 20, fontWeight: "800" },
  subtitle: { fontSize: 12, color: theme.colors.inkMuted },
});
