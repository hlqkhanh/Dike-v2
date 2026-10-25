import { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { theme } from "@/core/theme";
import { Icon, Text, ui } from "./ui";

const parseValue = (value: string) => {
  const parsed = new Date(value.replace(" ", "T"));
  return Number.isFinite(parsed.getTime())
    ? parsed
    : new Date(Date.now() + 3_600_000);
};

const serialize = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")} ${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;

const weekdays = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export function DeparturePicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState(() => parseValue(value));
  const [month, setMonth] = useState(
    () => new Date(draft.getFullYear(), draft.getMonth(), 1),
  );
  const days = useMemo(() => {
    const firstOffset = (month.getDay() + 6) % 7;
    const count = new Date(
      month.getFullYear(),
      month.getMonth() + 1,
      0,
    ).getDate();
    return [
      ...Array.from({ length: firstOffset }, () => null),
      ...Array.from({ length: count }, (_, i) => i + 1),
    ];
  }, [month]);

  const open = () => {
    const next = parseValue(value);
    setDraft(next);
    setMonth(new Date(next.getFullYear(), next.getMonth(), 1));
    setVisible(true);
  };
  const shiftTime = (minutes: number) => {
    const next = new Date(draft);
    next.setMinutes(next.getMinutes() + minutes);
    setDraft(next);
  };

  return (
    <View style={styles.group}>
      <Text style={ui.label}>Ngày và giờ khởi hành</Text>
      <Pressable
        accessibilityLabel="Ngày và giờ khởi hành"
        accessibilityRole="button"
        disabled={disabled}
        onPress={open}
        style={({ pressed }) => [
          styles.control,
          disabled && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <Icon name="calendar-outline" />
        <Text style={styles.value}>{value || "Chọn ngày và giờ"}</Text>
        <Icon name="chevron-down" size={18} />
      </Pressable>
      <Modal
        animationType="slide"
        transparent
        visible={visible}
        onRequestClose={() => setVisible(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.title}>Chọn ngày khởi hành</Text>
                <Text style={styles.subtitle}>
                  Ngày đã chọn sẽ được tô xanh
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Đóng lịch"
                onPress={() => setVisible(false)}
                style={styles.iconButton}
              >
                <Icon name="close" />
              </Pressable>
            </View>
            <View style={styles.monthHeader}>
              <Pressable
                accessibilityLabel="Tháng trước"
                onPress={() =>
                  setMonth(
                    new Date(month.getFullYear(), month.getMonth() - 1, 1),
                  )
                }
                style={styles.iconButton}
              >
                <Icon name="chevron-back" />
              </Pressable>
              <Text style={styles.monthTitle}>
                Tháng {month.getMonth() + 1}, {month.getFullYear()}
              </Text>
              <Pressable
                accessibilityLabel="Tháng sau"
                onPress={() =>
                  setMonth(
                    new Date(month.getFullYear(), month.getMonth() + 1, 1),
                  )
                }
                style={styles.iconButton}
              >
                <Icon name="chevron-forward" />
              </Pressable>
            </View>
            <View style={styles.calendar}>
              {weekdays.map((day) => (
                <Text key={day} style={styles.weekday}>
                  {day}
                </Text>
              ))}
              {days.map((day, index) => {
                const selected =
                  day === draft.getDate() &&
                  month.getMonth() === draft.getMonth() &&
                  month.getFullYear() === draft.getFullYear();
                return day ? (
                  <Pressable
                    key={`${month.getTime()}-${day}`}
                    accessibilityLabel={`Ngày ${day}`}
                    onPress={() => {
                      const next = new Date(draft);
                      next.setFullYear(
                        month.getFullYear(),
                        month.getMonth(),
                        day,
                      );
                      setDraft(next);
                    }}
                    style={[styles.day, selected && styles.daySelected]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        selected && styles.dayTextSelected,
                      ]}
                    >
                      {day}
                    </Text>
                  </Pressable>
                ) : (
                  <View key={`empty-${index}`} style={styles.day} />
                );
              })}
            </View>
            <View style={styles.timeRow}>
              <Text style={styles.timeLabel}>Giờ khởi hành</Text>
              <View style={styles.timeControl}>
                <Pressable
                  accessibilityLabel="Giảm 15 phút"
                  onPress={() => shiftTime(-15)}
                  style={styles.iconButton}
                >
                  <Icon name="remove" />
                </Pressable>
                <Text style={styles.timeValue}>
                  {String(draft.getHours()).padStart(2, "0")}:
                  {String(draft.getMinutes()).padStart(2, "0")}
                </Text>
                <Pressable
                  accessibilityLabel="Tăng 15 phút"
                  onPress={() => shiftTime(15)}
                  style={styles.iconButton}
                >
                  <Icon name="add" />
                </Pressable>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                onChange(serialize(draft));
                setVisible(false);
              }}
              style={styles.confirm}
            >
              <Text style={styles.confirmText}>Xác nhận thời gian</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(8, 35, 29, 0.38)",
    flex: 1,
    justifyContent: "flex-end",
  },
  calendar: { flexDirection: "row", flexWrap: "wrap" },
  confirm: {
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    justifyContent: "center",
    minHeight: 52,
  },
  confirmText: { color: "#fff", fontWeight: "800" },
  control: {
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: theme.spacing.sm,
    minHeight: 56,
    paddingHorizontal: theme.spacing.md,
  },
  day: {
    alignItems: "center",
    aspectRatio: 1,
    justifyContent: "center",
    width: "14.2857%",
  },
  daySelected: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.pill,
  },
  dayText: { fontSize: 14, fontWeight: "700" },
  dayTextSelected: { color: "#fff" },
  disabled: { opacity: 0.45 },
  group: { gap: theme.spacing.sm },
  iconButton: {
    alignItems: "center",
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  monthHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  monthTitle: { fontSize: 16, fontWeight: "800" },
  pressed: { opacity: 0.72 },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  sheetHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  subtitle: { color: theme.colors.inkMuted, fontSize: 12, marginTop: 2 },
  timeControl: { alignItems: "center", flexDirection: "row" },
  timeLabel: { fontSize: 15, fontWeight: "700" },
  timeRow: {
    alignItems: "center",
    backgroundColor: theme.colors.canvas,
    borderRadius: theme.radius.md,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingLeft: theme.spacing.md,
  },
  timeValue: {
    fontSize: 18,
    fontWeight: "900",
    minWidth: 60,
    textAlign: "center",
  },
  title: { fontSize: 20, fontWeight: "900" },
  value: { flex: 1, fontSize: 15, fontWeight: "700" },
  weekday: {
    color: theme.colors.inkMuted,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    width: "14.2857%",
  },
});
