import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "@/core/theme";
import { Icon, Text, type IconName } from "./ui";

export type RideVehicleOption = {
  id: string;
  title: string;
  description: string;
  label: string;
  icon: IconName;
  selected: boolean;
  price?: string;
  priceUnit?: string;
  onPress: () => void;
};

export function travelTime(seconds: number) {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours} giờ${remainder ? ` ${remainder} phút` : ""}`;
}

export function RideOptionsPanel({
  mode,
  origin,
  destination,
  onEditRoute,
  onRouteDetails,
  options,
  seats,
  maximum,
  onSeatsChange,
  disabled,
  status,
  advanced,
}: {
  mode: "driver" | "passenger";
  origin: string;
  destination: string;
  onEditRoute: () => void;
  onRouteDetails: () => void;
  options: RideVehicleOption[];
  seats: number;
  maximum: number;
  onSeatsChange: (value: number) => void;
  disabled: boolean;
  status?: ReactNode;
  advanced: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.content}>
      <View style={styles.routeRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sửa tuyến đường"
          disabled={disabled}
          onPress={onEditRoute}
          style={styles.route}
        >
          <View style={styles.rail}>
            <View style={styles.originDot} />
            <View style={styles.line} />
            <Icon name="location" size={16} color={theme.colors.passengerInk} />
          </View>
          <View style={styles.routeLabels}>
            <Text numberOfLines={1} style={styles.origin}>
              {origin}
            </Text>
            <Text numberOfLines={1} style={styles.destination}>
              {destination}
            </Text>
          </View>
          <Icon name="pencil-outline" size={18} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Xem chi tiết tuyến đường"
          onPress={onRouteDetails}
          style={styles.iconButton}
        >
          <Icon name="information-circle-outline" />
        </Pressable>
      </View>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.headingText}>
          {mode === "driver" ? "Chọn xe của bạn" : "Bạn muốn đi xe nào?"}
        </Text>
        <Text style={styles.hint}>
          {mode === "driver" ? "Chia sẻ hành trình" : "Đi chung, tiết kiệm hơn"}
        </Text>
      </View>
      <View style={styles.vehicles}>
        {options.map((option) => (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: option.selected, disabled }}
            disabled={disabled}
            onPress={option.onPress}
            style={({ pressed }) => [
              styles.vehicle,
              option.selected && styles.selected,
              pressed && styles.pressed,
            ]}
          >
            <LinearGradient
              pointerEvents="none"
              colors={[theme.vehicleGlass.highlight, theme.vehicleGlass.sheen]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.glassSheen}
            />
            <View style={styles.vehicleArt}>
              <Icon name={option.icon} size={32} />
            </View>
            <View style={styles.vehicleCopy}>
              <Text style={styles.vehicleTitle}>{option.title}</Text>
              <Text numberOfLines={1} style={styles.description}>
                {option.description}
              </Text>
            </View>
            <View style={styles.price}>
              {option.price ? (
                <>
                  <Text style={styles.priceText}>{option.price}</Text>
                  <Text style={styles.description}>
                    {option.priceUnit ?? "dự kiến"}
                  </Text>
                </>
              ) : null}
            </View>
            <Icon
              name={option.selected ? "checkmark-circle" : "ellipse-outline"}
              size={22}
              color={
                option.selected ? theme.colors.primary : theme.colors.inkMuted
              }
            />
          </Pressable>
        ))}
      </View>
      {status}
      <View style={styles.seats}>
        <View style={styles.vehicleCopy}>
          <Text style={styles.seatLabel}>
            {mode === "driver" ? "Số chỗ chia sẻ" : "Số người đi"}
          </Text>
          <Text style={styles.description}>
            Tối đa {maximum} {mode === "driver" ? "chỗ" : "người"}
          </Text>
        </View>
        <View style={styles.stepper}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Giảm số chỗ"
            disabled={disabled || seats <= 1}
            onPress={() => onSeatsChange(seats - 1)}
            style={styles.iconButton}
          >
            <Icon
              name="remove"
              color={seats <= 1 ? theme.colors.inkMuted : theme.colors.primary}
            />
          </Pressable>
          <Text accessibilityLiveRegion="polite" style={styles.seatNumber}>
            {seats}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tăng số chỗ"
            disabled={disabled || seats >= maximum}
            onPress={() => onSeatsChange(seats + 1)}
            style={styles.iconButton}
          >
            <Icon
              name="add"
              color={
                seats >= maximum ? theme.colors.inkMuted : theme.colors.primary
              }
            />
          </Pressable>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Chi phí và lời nhắn"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={styles.more}
      >
        <Icon name="options-outline" size={20} />
        <Text style={styles.moreText}>
          {mode === "driver" ? "Chi phí và lời nhắn" : "Thêm lời nhắn"}
        </Text>
        <Icon name={expanded ? "chevron-up" : "chevron-down"} size={18} />
      </Pressable>
      {expanded ? <View style={styles.advanced}>{advanced}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: theme.spacing.md },
  routeRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    alignItems: "center",
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  route: {
    flex: 1,
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  rail: { width: theme.spacing.lg, alignItems: "center" },
  originDot: {
    width: theme.spacing.sm,
    height: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primary,
  },
  line: {
    width: 1,
    height: theme.spacing.sm,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.xs,
  },
  routeLabels: { flex: 1, gap: theme.spacing.sm },
  origin: { fontWeight: "700", fontSize: 13 },
  destination: { color: theme.colors.inkMuted, fontSize: 13 },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    justifyContent: "space-between",
  },
  headingText: { fontSize: 18, fontWeight: "800" },
  hint: { fontSize: 12, color: theme.colors.inkMuted },
  vehicles: { gap: theme.spacing.sm },
  vehicle: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    minHeight: theme.journey.vehicleHeight,
    padding: theme.spacing.sm,
    backgroundColor: theme.vehicleGlass.background,
    borderWidth: 1,
    borderColor: theme.vehicleGlass.border,
    borderRadius: theme.radius.md,
    shadowColor: theme.colors.ink,
    shadowOffset: { width: 0, height: theme.vehicleGlass.shadowOffset },
    shadowOpacity: theme.vehicleGlass.shadowOpacity,
    shadowRadius: theme.vehicleGlass.shadowRadius,
    elevation: 1,
  },
  selected: {
    borderColor: theme.vehicleGlass.selectedBorder,
  },
  glassSheen: {
    ...StyleSheet.absoluteFill,
    borderRadius: theme.radius.md,
  },
  vehicleArt: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleCopy: { flex: 1, gap: theme.spacing.xs },
  vehicleTitle: { fontSize: 16, fontWeight: "800" },
  description: { fontSize: 12, color: theme.colors.inkMuted },
  price: { alignItems: "flex-end", gap: theme.spacing.xs },
  priceText: { fontSize: 15, fontWeight: "800" },
  seats: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  seatLabel: { fontSize: 14, fontWeight: "700" },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.canvas,
    borderRadius: theme.radius.pill,
  },
  iconButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  seatNumber: {
    minWidth: theme.spacing.lg,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "800",
  },
  more: {
    flexDirection: "row",
    minHeight: 48,
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  moreText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  advanced: { gap: theme.spacing.md },
  pressed: { opacity: 0.8 },
});
