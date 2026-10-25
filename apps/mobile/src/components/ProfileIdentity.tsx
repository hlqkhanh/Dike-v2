import type { PropsWithChildren } from "react";
import { Image, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { pageAssets } from "@/core/assets";
import { Avatar, Card, Text } from "./ui";

export function ProfileIdentity({
  name,
  avatar,
  children,
}: PropsWithChildren<{ name?: string; avatar?: string }>) {
  return (
    <Card style={styles.card}>
      <View style={styles.cover}>
        <Image
          accessible={false}
          source={pageAssets.route}
          resizeMode="cover"
          style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]}
        />
        <LinearGradient
          colors={["rgba(232,249,239,.05)", "rgba(232,249,239,.4)"]}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Avatar name={name} uri={avatar} size={88} />
        </View>
        <Text accessibilityRole="header" style={styles.name}>
          {name}
        </Text>
        {children}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0, gap: 0, borderRadius: 28, overflow: "hidden" },
  cover: { height: 110, backgroundColor: "#dff3e9" },
  identity: {
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 26,
  },
  avatar: {
    marginTop: -40,
    padding: 5,
    borderRadius: 55,
    backgroundColor: "#fff",
  },
  name: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: "800",
    textAlign: "center",
    color: "#103e31",
    letterSpacing: -0.7,
  },
});
