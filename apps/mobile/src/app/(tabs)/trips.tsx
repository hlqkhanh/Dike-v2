import { ImageBackground, Pressable, StyleSheet, View } from "react-native";
import { router, type Href } from "expo-router";
import { Screen } from "@/components/Screen";
import { Icon, Text, type IconName } from "@/components/ui";
import { journeyHubAssets } from "@/core/assets";
import { theme } from "@/core/theme";

const sections: {
  title: string;
  description: string;
  action: string;
  href: Href;
  icon: IconName;
  image: (typeof journeyHubAssets)[keyof typeof journeyHubAssets];
  tone: string;
}[] = [
  {
    title: "Lịch trình",
    description: "Sắp xếp lịch đi, lượt về và các hành trình sắp tới.",
    action: "Mở lịch trình",
    href: "/schedules",
    icon: "calendar-outline",
    image: journeyHubAssets.schedule,
    tone: "#e4f7ee",
  },
  {
    title: "Đề nghị",
    description: "Theo dõi và trao đổi các đề nghị đi cùng của bạn.",
    action: "Mở đề nghị",
    href: "/requests",
    icon: "people-outline",
    image: journeyHubAssets.proposal,
    tone: "#fff5d9",
  },
  {
    title: "Booking",
    description: "Quản lý những chuyến đã ghép và đặt chỗ của bạn.",
    action: "Mở booking",
    href: "/bookings",
    icon: "ticket-outline",
    image: journeyHubAssets.booking,
    tone: "#e6f5ff",
  },
];

export default function Trips() {
  return (
    <Screen title="" hideHeader backgroundColor="#fff">
      <Text accessibilityRole="header" style={styles.pageTitle}>
        Chuyến đi
      </Text>
      <View style={styles.list}>
        {sections.map((section) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={section.action}
            key={section.title}
            onPress={() => router.push(section.href)}
            style={({ pressed }) => [styles.shell, pressed && styles.pressed]}
          >
            <ImageBackground
              source={section.image}
              resizeMode="cover"
              imageStyle={[
                styles.image,
                section.title === "Lịch trình" && styles.scheduleImage,
              ]}
              style={[styles.card, { backgroundColor: section.tone }]}
            >
              <View style={styles.iconBox}>
                <Icon name={section.icon} size={25} />
              </View>
              <View style={styles.arrow}>
                <Icon name="arrow-forward" size={19} />
              </View>
              <View style={styles.copy}>
                <Text style={styles.title}>{section.title}</Text>
                <Text style={styles.description}>{section.description}</Text>
                <View style={styles.action}>
                  <Text style={styles.actionText}>{section.action}</Text>
                </View>
              </View>
            </ImageBackground>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  action: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.pill,
    marginTop: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 9,
  },
  actionText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  arrow: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.82)",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    position: "absolute",
    right: 14,
    top: 14,
    width: 44,
  },
  card: { minHeight: 205, overflow: "hidden", padding: theme.spacing.md },
  copy: { gap: 5, marginTop: "auto", maxWidth: "62%" },
  description: { color: theme.colors.inkMuted, fontSize: 13, lineHeight: 19 },
  iconBox: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.78)",
    borderRadius: theme.radius.md,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  image: { borderRadius: theme.radius.lg, transform: [{ scale: 1.12 }] },
  list: { gap: theme.spacing.md },
  pageTitle: { color: theme.colors.ink, fontSize: 30, fontWeight: "900" },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  scheduleImage: { transform: [{ scale: 1.2 }] },
  shell: {
    ...theme.shadow.card,
    backgroundColor: "#fff",
    borderRadius: theme.radius.lg,
    overflow: "hidden",
  },
  title: { color: theme.colors.ink, fontSize: 25, fontWeight: "900" },
});
