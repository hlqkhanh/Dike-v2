import type {
  RidePostResponse,
  RidePostView,
  RoutePoint,
} from "@dike/api-client-ts";
import { StyleSheet, View } from "react-native";
import { mergedJourneyStops } from "@/core/journey-stops";
import { splitPlaceLabel } from "@/core/place-label";
import { Avatar, Text } from "./ui";
import { theme } from "@/core/theme";

export function MergedJourneyStops({
  post,
  response,
  ownerGeometry,
}: {
  post: RidePostView;
  response: RidePostResponse;
  ownerGeometry?: RoutePoint[];
}) {
  const stops = mergedJourneyStops(post, response, ownerGeometry);
  return (
    <View style={styles.route} testID="merged-journey-stops">
      {stops.map((stop, index) => {
        const color = stop.kind === "origin" ? "#dcb84b" : theme.colors.primary;
        const place = splitPlaceLabel(stop.label);
        return (
          <View
            key={stop.kind + index}
            style={styles.row}
            testID="merged-journey-stop"
          >
            <View style={styles.rail} accessible={false}>
              {index > 0 ? (
                <View style={[styles.before, { backgroundColor: color }]} />
              ) : null}
              {index < stops.length - 1 ? (
                <View style={[styles.after, { backgroundColor: color }]} />
              ) : null}
              <View
                style={[
                  styles.dot,
                  {
                    borderColor: color,
                    backgroundColor: stop.kind === "origin" ? "#fff" : color,
                  },
                ]}
              />
            </View>
            <View style={[styles.field, { borderColor: color }]}>
              <View style={styles.heading}>
                <Text style={styles.caption}>
                  {stop.kind === "origin" ? "Điểm đi" : "Điểm đến"} ·{" "}
                  {stop.members.length > 1 ? (
                    "Cả hai"
                  ) : (
                    <Text userId={stop.members[0].id} style={styles.caption}>
                      {stop.members[0].name}
                    </Text>
                  )}
                </Text>
                <View style={styles.members}>
                  {stop.members.map((member) => (
                    <Avatar
                      userId={member.id}
                      key={member.id}
                      size={18}
                      name={member.name}
                      uri={member.avatarUrl}
                    />
                  ))}
                </View>
              </View>
              <Text style={styles.name}>{place.name}</Text>
              {place.address ? (
                <Text style={styles.address}>{place.address}</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  route: { gap: 12 },
  row: { flexDirection: "row", alignItems: "stretch", gap: 8 },
  rail: { width: 16, alignItems: "center", justifyContent: "center" },
  before: { position: "absolute", top: -6, bottom: "50%", width: 2 },
  after: { position: "absolute", top: "50%", bottom: -6, width: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  field: {
    flex: 1,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 3,
  },
  heading: { flexDirection: "row", alignItems: "center", gap: 6 },
  caption: { flex: 1, fontSize: 10, color: theme.colors.inkMuted },
  members: { flexDirection: "row", gap: 3 },
  name: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: theme.colors.ink,
  },
  address: { fontSize: 11, lineHeight: 16, color: theme.colors.inkMuted },
});
