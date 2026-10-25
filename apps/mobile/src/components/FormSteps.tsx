import { StyleSheet, View } from "react-native";
import { theme } from "@/core/theme";
import { Icon, Text } from "./ui";

export function FormSteps({
  labels,
  current,
}: {
  labels: string[];
  current: number;
}) {
  return (
    <View
      style={styles.steps}
      accessibilityLabel={`Bước ${current + 1} trên ${labels.length}: ${labels[current]}`}
    >
      {labels.map((label, index) => (
        <View key={label} style={styles.step}>
          <View style={styles.trackRow}>
            {index > 0 ? (
              <View
                style={[styles.line, index <= current && styles.lineActive]}
              />
            ) : (
              <View style={styles.lineSpacer} />
            )}
            <View style={[styles.dot, index <= current && styles.active]}>
              {index < current ? (
                <Icon name="checkmark" size={16} color={theme.colors.surface} />
              ) : (
                <Text
                  style={[
                    styles.number,
                    index === current && styles.numberActive,
                  ]}
                >
                  {index + 1}
                </Text>
              )}
            </View>
            {index < labels.length - 1 ? (
              <View
                style={[styles.line, index < current && styles.lineActive]}
              />
            ) : (
              <View style={styles.lineSpacer} />
            )}
          </View>
          <Text
            style={[styles.label, index === current && styles.labelActive]}
            numberOfLines={2}
          >
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  active: { backgroundColor: theme.colors.primary },
  dot: {
    alignItems: "center",
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.pill,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  label: {
    color: theme.colors.inkMuted,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
  },
  labelActive: { color: theme.colors.primary, fontWeight: "800" },
  line: { backgroundColor: theme.colors.border, flex: 1, height: 2 },
  lineActive: { backgroundColor: theme.colors.primary },
  lineSpacer: { flex: 1 },
  number: { color: theme.colors.inkMuted, fontSize: 12, fontWeight: "800" },
  numberActive: { color: theme.colors.surface },
  step: { alignItems: "center", flex: 1, gap: theme.spacing.sm },
  steps: { flexDirection: "row", paddingVertical: theme.spacing.sm },
  trackRow: { alignItems: "center", flexDirection: "row", width: "100%" },
});
