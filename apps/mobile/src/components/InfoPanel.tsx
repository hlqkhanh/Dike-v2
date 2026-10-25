import { StyleSheet, View } from "react-native";
import { Icon, Text, type IconName } from "./ui";

export function InfoPanel({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: IconName;
}) {
  return (
    <View style={styles.panel}>
      <View style={styles.icon}>
        <Icon name={icon} size={23} />
      </View>
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  panel: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    backgroundColor: "#e8f6ef",
    padding: 18,
    borderRadius: 24,
    borderColor: "#d9ece1",
    borderWidth: 1,
  },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 15, fontWeight: "800", lineHeight: 22, color: "#12342d" },
  description: { fontSize: 12, lineHeight: 19, color: "#526e62" },
});
