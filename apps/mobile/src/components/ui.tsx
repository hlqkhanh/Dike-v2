import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import {
  useState,
  type ComponentProps,
  type ComponentPropsWithRef,
  type PropsWithChildren,
} from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  View,
  type ColorValue,
  type TextProps,
  type TextStyle,
  type TextInputProps,
  type ViewStyle,
  type StyleProp,
} from "react-native";
import { theme } from "@/core/theme";
import { avatarSource } from "@/core/avatar-source";
import { useReducedMotion } from "@/core/accessibility";

function typographyStyle(style: StyleProp<TextStyle>): TextStyle {
  const flat = StyleSheet.flatten(style);
  const weight =
    flat?.fontWeight === "bold" ? 700 : Number(flat?.fontWeight ?? 400);
  const fontFamily =
    weight >= 800
      ? theme.font.heavy
      : weight >= 700
        ? theme.font.bold
        : weight >= 600
          ? theme.font.semibold
          : weight >= 500
            ? theme.font.medium
            : theme.font.regular;
  // Each loaded family is a specific weight; avoid synthetic bold on native.
  return { ...flat, fontFamily, fontWeight: "normal" };
}

export function Text({ style, ...props }: TextProps) {
  return (
    <NativeText
      {...props}
      style={[{ color: theme.colors.ink }, typographyStyle(style)]}
    />
  );
}

export function TextInput({
  style,
  ...props
}: ComponentPropsWithRef<typeof NativeTextInput>) {
  return <NativeTextInput {...props} style={typographyStyle(style)} />;
}
export type IconName = ComponentProps<typeof Ionicons>["name"];
export function Icon({
  name,
  size = 22,
  color = theme.colors.primary,
}: {
  name: IconName;
  size?: number;
  color?: ColorValue;
}) {
  return (
    <Ionicons
      accessible={false}
      aria-hidden={true}
      name={name}
      size={size}
      color={color}
    />
  );
}
export function Button({
  label,
  onPress,
  pending,
  disabled,
  variant = "primary",
  icon,
}: {
  label: string;
  onPress: () => void;
  pending?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  icon?: IconName;
}) {
  const light = variant === "secondary";
  const color = light ? theme.colors.primary : "#fff";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || pending, busy: pending }}
      disabled={disabled || pending}
      onPress={onPress}
      style={({ pressed }) => [
        ui.button,
        light && ui.secondary,
        variant === "danger" && { backgroundColor: theme.colors.danger },
        (disabled || pending) && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
      ]}
    >
      {pending ? (
        <ActivityIndicator color={color} />
      ) : icon ? (
        <Icon name={icon} color={color} size={20} />
      ) : null}
      <Text style={[ui.buttonText, { color }]}>{label}</Text>
    </Pressable>
  );
}
export function Field({
  label,
  error,
  style,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Text style={ui.label}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor="#8ca198"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          ui.input,
          focused && { borderColor: theme.colors.primary },
          error && { borderColor: theme.colors.danger },
          props.multiline && { minHeight: 100, textAlignVertical: "top" },
          style,
        ]}
      />
      {error ? <ErrorText error={error} /> : null}
    </View>
  );
}
export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[ui.card, style]}>{children}</View>;
}
export function Chip({
  label,
  selected,
  onPress,
  gold,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  gold?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityState={{ selected }}
      onPress={onPress}
      disabled={!onPress}
      style={[
        ui.chip,
        selected && {
          backgroundColor: gold ? theme.colors.passenger : theme.colors.primary,
          borderColor: "transparent",
        },
      ]}
    >
      <Text
        style={[
          ui.chipText,
          selected && { color: gold ? theme.colors.ink : "#fff" },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Avatar({
  name,
  uri,
  size = 46,
}: {
  name?: string;
  uri?: string | null;
  size?: number;
}) {
  const [failedUri, setFailedUri] = useState<string | null | undefined>();
  const source = avatarSource(uri);
  return source && failedUri !== uri ? (
    <Image
      accessibilityLabel={name || "Ảnh đại diện"}
      source={source}
      onError={() => setFailedUri(uri)}
      resizeMode="cover"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        flexShrink: 0,
      }}
    />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: size / 2,
        backgroundColor: "#dbf2e6",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text
        style={{
          fontSize: size * 0.38,
          fontWeight: "800",
          color: theme.colors.primary,
        }}
      >
        {name?.trim().charAt(0).toUpperCase() || "D"}
      </Text>
    </View>
  );
}
export function Badge({ label, gold }: { label: string; gold?: boolean }) {
  return (
    <View
      style={[
        ui.badge,
        gold && { backgroundColor: theme.colors.passengerSoft },
      ]}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: "700",
          color: gold ? theme.colors.passengerInk : theme.colors.primary,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
export function ErrorText({ error }: { error: unknown }) {
  return error ? (
    <Text
      accessibilityRole="alert"
      style={{ color: theme.colors.danger, fontSize: 14, lineHeight: 22 }}
    >
      {error instanceof Error ? error.message : String(error)}
    </Text>
  ) : null;
}
export function EmptyState({
  title,
  description,
  icon = "leaf-outline",
  onRetry,
}: {
  title: string;
  description?: string;
  icon?: IconName;
  onRetry?: () => void;
}) {
  return (
    <Card style={{ alignItems: "center", paddingVertical: 30 }}>
      <View style={ui.emptyIcon}>
        <Icon name={icon} size={30} />
      </View>
      <Text style={ui.sectionTitle}>{title}</Text>
      {description ? (
        <Text style={[ui.muted, { textAlign: "center" }]}>{description}</Text>
      ) : null}
      {onRetry ? (
        <Button
          label="Thử lại"
          onPress={onRetry}
          variant="secondary"
          icon="refresh-outline"
        />
      ) : null}
    </Card>
  );
}
export function LoadingCards() {
  return (
    <View accessibilityLabel="Đang tải nội dung" style={{ gap: 16 }}>
      {[0, 1, 2].map((i) => (
        <Card key={i}>
          <View style={[ui.skeleton, { width: "50%", height: 18 }]} />
          <View style={[ui.skeleton, { height: 70 }]} />
          <View style={[ui.skeleton, { width: "70%" }]} />
        </Card>
      ))}
    </View>
  );
}
export function BottomSheet({
  visible,
  title,
  onClose,
  children,
}: PropsWithChildren<{
  visible: boolean;
  title: string;
  onClose: () => void;
}>) {
  const reducedMotion = useReducedMotion();
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? "none" : "slide"}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={ui.overlay}
      >
        <Pressable
          accessibilityLabel="Đóng"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View accessibilityViewIsModal style={ui.sheet}>
          <View style={ui.row}>
            <Text
              accessibilityRole="header"
              style={[ui.sectionTitle, { flex: 1 }]}
            >
              {title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng"
              onPress={onClose}
              style={ui.iconButton}
            >
              <Icon name="close-outline" />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 16, paddingBottom: 24 }}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
export function HeroArt({
  kind = "route",
}: {
  kind?: "route" | "bell" | "shield";
}) {
  const name: IconName =
    kind === "bell"
      ? "notifications-outline"
      : kind === "shield"
        ? "shield-checkmark-outline"
        : "car-sport-outline";
  return (
    <View accessible={false} style={ui.art}>
      <View style={ui.artHalo} />
      <View
        style={[ui.artCard, { left: 12, transform: [{ rotate: "-12deg" }] }]}
      >
        <Icon name="leaf-outline" size={23} />
        <View style={ui.artLine} />
      </View>
      <View
        style={[
          ui.artCard,
          { right: 8, top: 35, transform: [{ rotate: "12deg" }] },
        ]}
      >
        <Icon name="location-outline" size={24} />
        <View style={ui.artLine} />
      </View>
      <LinearGradient colors={["#53cba0", "#087d61"]} style={ui.artCenter}>
        <Icon name={name} size={44} color="#fff" />
      </LinearGradient>
      <View style={ui.artLeaf}>
        <Icon name="checkmark" size={19} color="#fff" />
      </View>
    </View>
  );
}
export function RouteCard({
  origin,
  destination,
}: {
  origin: string;
  destination: string;
}) {
  return (
    <View style={ui.route}>
      <View style={{ alignItems: "center", width: 22 }}>
        <Icon name="radio-button-on-outline" size={18} />
        <View
          style={{
            width: 1,
            flex: 1,
            minHeight: 26,
            backgroundColor: "#a9d9c6",
          }}
        />
        <Icon name="location" size={20} color={theme.colors.passengerInk} />
      </View>
      <View style={{ flex: 1, gap: 18 }}>
        <View>
          <Text style={ui.eyebrow}>ĐIỂM ĐI</Text>
          <Text style={ui.routePlace}>{origin}</Text>
        </View>
        <View>
          <Text style={ui.eyebrow}>ĐIỂM ĐẾN</Text>
          <Text style={ui.routePlace}>{destination}</Text>
        </View>
      </View>
    </View>
  );
}
export function Section({
  title,
  children,
}: PropsWithChildren<{ title: string }>) {
  return (
    <View style={{ gap: 12 }}>
      <Text style={ui.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}
export const ui = StyleSheet.create({
  card: {
    ...theme.shadow.card,
    backgroundColor: "#fff",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 20,
    gap: 14,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sectionTitle: { fontSize: 19, fontWeight: "800", letterSpacing: -0.4 },
  muted: { color: theme.colors.inkMuted, fontSize: 14, lineHeight: 23 },
  eyebrow: {
    color: theme.colors.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.3,
  },
  button: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  secondary: {
    backgroundColor: "#e8f5ee",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "800",
    flexShrink: 1,
    textAlign: "center",
  },
  label: { fontSize: 14, fontWeight: "700" },
  input: {
    minHeight: 52,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d5e5dd",
    borderRadius: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: theme.font.regular,
    fontSize: 15,
    color: theme.colors.ink,
  },
  chip: {
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 17,
    justifyContent: "center",
  },
  chipText: { fontSize: 13, fontWeight: "700" },
  badge: {
    borderRadius: 99,
    backgroundColor: "#e8f5ee",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  iconButton: {
    minHeight: 48,
    minWidth: 48,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyIcon: {
    height: 64,
    width: 64,
    borderRadius: 24,
    backgroundColor: "#eaf6ef",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  skeleton: { backgroundColor: "#eaf2ed", borderRadius: 10, height: 14 },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(9,38,28,.4)",
  },
  sheet: {
    backgroundColor: theme.colors.canvas,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    gap: 16,
    maxHeight: "85%",
  },
  art: {
    width: 220,
    height: 150,
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
  },
  artHalo: {
    position: "absolute",
    bottom: 0,
    width: 180,
    height: 115,
    backgroundColor: "#d9f2e5",
    borderRadius: 100,
  },
  artCard: {
    position: "absolute",
    width: 90,
    height: 70,
    top: 40,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,.9)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...theme.shadow.card,
  },
  artLine: {
    height: 4,
    borderRadius: 4,
    width: 40,
    backgroundColor: "#b3dfcb",
  },
  artCenter: {
    height: 87,
    width: 87,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    ...theme.shadow.card,
  },
  artLeaf: {
    position: "absolute",
    right: 43,
    top: 22,
    backgroundColor: "#55bb8e",
    borderRadius: 10,
    padding: 7,
    transform: [{ rotate: "10deg" }],
  },
  route: {
    flexDirection: "row",
    gap: 12,
    padding: 18,
    backgroundColor: "#f1f9f5",
    borderRadius: 18,
  },
  routePlace: { fontSize: 15, fontWeight: "700", lineHeight: 23, marginTop: 4 },
});
