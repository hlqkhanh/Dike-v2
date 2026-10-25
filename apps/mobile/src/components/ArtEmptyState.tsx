import { Image, StyleSheet, View } from "react-native";
import { pageAssets, type PageArt } from "@/core/assets";
import { Button, Card, Text } from "./ui";

export function ArtEmptyState({
  title,
  description,
  art = "journey",
  action,
  onPress,
}: {
  title: string;
  description: string;
  art?: PageArt;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <Card style={styles.card}>
      <Image
        accessible={false}
        source={pageAssets[art]}
        resizeMode="contain"
        style={styles.art}
      />
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Text style={styles.description}>{description}</Text>
      {action && onPress ? (
        <View style={{ alignSelf: "stretch" }}>
          <Button label={action} onPress={onPress} />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: "center", gap: 16, paddingVertical: 26 },
  art: { width: "100%", height: 130 },
  title: {
    color: "#12342d",
    fontWeight: "800",
    fontSize: 21,
    textAlign: "center",
    lineHeight: 29,
  },
  description: {
    color: "#526e62",
    textAlign: "center",
    fontSize: 14,
    lineHeight: 23,
    maxWidth: 280,
  },
});
