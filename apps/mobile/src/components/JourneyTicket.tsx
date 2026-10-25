import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { Badge, Card, Icon, Text, ui } from "./ui";

export function JourneyTicket({
  status,
  label,
  passenger = false,
  children,
}: PropsWithChildren<{
  status: string;
  label: string;
  passenger?: boolean;
}>) {
  return (
    <Card style={styles.ticket}>
      <View
        style={[styles.header, passenger ? styles.passenger : styles.driver]}
      >
        <View
          style={[
            styles.mark,
            passenger ? { backgroundColor: "#faedc5" } : null,
          ]}
        >
          <Icon
            name={passenger ? "ticket-outline" : "navigate-outline"}
            size={20}
            color={passenger ? "#8e6616" : "#087d61"}
          />
        </View>
        <Text style={[ui.eyebrow, { flex: 1, letterSpacing: 0.7 }]}>
          {label}
        </Text>
        <Badge label={status} gold={passenger} />
      </View>
      <View style={styles.body}>{children}</View>
      <View style={styles.perforation} />
    </Card>
  );
}

const styles = StyleSheet.create({
  ticket: { padding: 0, overflow: "hidden", borderRadius: 26, gap: 0 },
  header: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e4eee8",
  },
  driver: { backgroundColor: "#f0faf5" },
  passenger: { backgroundColor: "#fffbef" },
  mark: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#ddf2e7",
    alignItems: "center",
    justifyContent: "center",
  },
  body: { padding: 20, gap: 16 },
  perforation: {
    marginHorizontal: 18,
    marginBottom: 10,
    borderTopWidth: 1,
    borderStyle: "dashed",
    borderColor: "#d4e6dc",
    height: 4,
  },
});
