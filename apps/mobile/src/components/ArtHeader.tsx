import { Image, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { pageAssets, type PageArt } from "@/core/assets";
import { theme } from "@/core/theme";
import { Text } from "./ui";

export function ArtHeader({
  title,
  subtitle,
  art,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  art: PageArt;
  eyebrow?: string;
}) {
  return (
    <View style={styles.frame}>
      <Image
        accessible={false}
        source={pageAssets[art]}
        resizeMode="cover"
        style={styles.image}
      />
      <LinearGradient
        colors={[
          "rgba(240,251,246,.98)",
          "rgba(240,251,246,.9)",
          "rgba(240,251,246,.08)",
        ]}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.copy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: "hidden",
    borderRadius: 28,
    minHeight: 158,
    borderWidth: 1,
    borderColor: "#d9eee3",
    backgroundColor: "#e5f5ee",
  },
  image: {
    position: "absolute",
    right: -8,
    top: -8,
    width: "82%",
    height: "112%",
  },
  copy: {
    gap: 8,
    padding: 22,
    width: "82%",
    minHeight: 158,
    justifyContent: "center",
  },
  eyebrow: {
    color: theme.colors.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.7,
  },
  title: {
    color: theme.colors.ink,
    fontSize: 27,
    fontWeight: "800",
    lineHeight: 35,
    letterSpacing: -0.9,
  },
  subtitle: { color: "#55776a", fontSize: 13, lineHeight: 20, maxWidth: 210 },
});
