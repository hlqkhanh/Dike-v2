import { Image, StyleSheet, View } from "react-native";
import { Icon } from "./ui";
import driverOrigin from "../../assets/art/journey-location-driver-origin-v2.png";
import driverDestination from "../../assets/art/journey-location-driver-destination-v2.png";
import passengerOrigin from "../../assets/art/journey-location-passenger-origin-v2.png";
import passengerDestination from "../../assets/art/journey-location-passenger-destination-v2.png";
import sharedOrigin from "../../assets/art/journey-location-shared-origin-v2.png";
import sharedDestination from "../../assets/art/journey-location-shared-destination-v2.png";

const roleArtwork = {
  driver: { origin: driverOrigin, destination: driverDestination },
  passenger: { origin: passengerOrigin, destination: passengerDestination },
  shared: { origin: sharedOrigin, destination: sharedDestination },
};
export type JourneyArtKind =
  | "confirmed"
  | "pickup"
  | "arrived"
  | "driver"
  | "passenger"
  | "shared"
  | "place"
  | "completed"
  | "payment";

/** Role mascots identify the people at a stop, independently of the place name. */
export function JourneyCardArt({
  kind,
  direction = "origin",
}: {
  kind: JourneyArtKind;
  direction?: "origin" | "destination";
}) {
  if (kind === "driver" || kind === "passenger" || kind === "shared") {
    return (
      <View testID={"journey-art-" + kind} style={styles.art}>
        <Image
          testID={"journey-art-" + kind + "-" + direction}
          accessible={false}
          source={roleArtwork[kind][direction]}
          resizeMode="contain"
          style={styles.art}
        />
      </View>
    );
  }
  return (
    <View style={styles.art} pointerEvents="none" accessible={false}>
      <View
        style={[
          styles.glow,
          {
            backgroundColor: kind === "payment" ? "#d9eaff" : "#e3f5c9",
          },
        ]}
      />
      <View style={styles.ground} />
      {kind === "confirmed" ? (
        <View style={styles.clipboard}>
          <View style={styles.clip} />
          {[0, 1, 2].map((row) => (
            <View key={row} style={styles.checkRow}>
              <Icon name="checkmark" size={12} color="#2eb58b" />
              <View style={styles.checkLine} />
            </View>
          ))}
        </View>
      ) : kind === "arrived" ? (
        <>
          <View style={styles.flagShadow} />
          <View style={styles.flag}>
            <Icon name="flag" size={45} color="#f2c64b" />
          </View>
        </>
      ) : kind === "pickup" || kind === "place" ? (
        <>
          <View style={styles.routeLoop} />
          <View style={styles.pin}>
            <Icon name="location" size={40} color="#138971" />
          </View>
          <View style={styles.routeDot} />
        </>
      ) : kind === "completed" ? (
        <View style={styles.success}>
          <Icon name="checkmark" size={32} color="#fff" />
        </View>
      ) : (
        <>
          <View style={styles.wallet}>
            <Icon name="wallet" size={47} color="#53bbaa" />
          </View>
          <View style={styles.coin}>
            <Icon name="checkmark" size={13} color="#b68d15" />
          </View>
        </>
      )}
      <View
        style={[
          styles.spark,
          { left: 3, top: 14, transform: [{ rotate: "-35deg" }] },
        ]}
      />
      <View
        style={[
          styles.spark,
          { left: 11, top: 5, transform: [{ rotate: "-12deg" }] },
        ]}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  art: { width: 66, height: 70, flexShrink: 0 },
  glow: {
    position: "absolute",
    width: 57,
    height: 54,
    borderRadius: 30,
    top: 5,
    right: -2,
    opacity: 0.65,
  },
  ground: {
    position: "absolute",
    width: 66,
    height: 11,
    borderRadius: 40,
    bottom: 7,
    backgroundColor: "#bce5d3",
    opacity: 0.6,
  },
  spark: {
    position: "absolute",
    width: 4,
    height: 10,
    borderRadius: 3,
    backgroundColor: "#f9d74d",
  },
  clipboard: {
    position: "absolute",
    left: 23,
    top: 14,
    width: 32,
    height: 43,
    paddingTop: 8,
    borderWidth: 2.5,
    borderColor: "#37b690",
    backgroundColor: "#fffefa",
    borderRadius: 5,
    transform: [{ rotate: "13deg" }],
    shadowColor: "#5aa894",
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
    elevation: 2,
  },
  clip: {
    position: "absolute",
    top: -5,
    left: 7,
    width: 14,
    height: 8,
    borderRadius: 3,
    borderWidth: 2,
    borderColor: "#37b690",
    backgroundColor: "#c3efda",
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 2,
    gap: 2,
    height: 9,
  },
  checkLine: {
    width: 11,
    height: 2,
    borderRadius: 2,
    backgroundColor: "#bad5cb",
  },
  flagShadow: {
    position: "absolute",
    bottom: 10,
    left: 16,
    width: 43,
    height: 10,
    borderRadius: 40,
    backgroundColor: "#9cd79b",
  },
  flag: {
    position: "absolute",
    left: 18,
    top: 9,
    transform: [{ rotate: "9deg" }],
  },
  routeLoop: {
    position: "absolute",
    left: 5,
    bottom: 13,
    width: 50,
    height: 23,
    borderRadius: 30,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#8dbeb1",
    transform: [{ rotate: "-13deg" }],
  },
  pin: {
    position: "absolute",
    right: 0,
    top: 3,
    transform: [{ rotate: "8deg" }],
  },
  routeDot: {
    position: "absolute",
    left: 9,
    bottom: 20,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#a9d8ca",
  },
  success: {
    position: "absolute",
    top: 13,
    left: 16,
    height: 43,
    width: 43,
    borderRadius: 22,
    backgroundColor: "#4cbea0",
    alignItems: "center",
    justifyContent: "center",
  },
  wallet: {
    position: "absolute",
    top: 10,
    left: 13,
    transform: [{ rotate: "-8deg" }],
  },
  coin: {
    position: "absolute",
    bottom: 11,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#efd168",
    backgroundColor: "#ffeb9a",
    alignItems: "center",
    justifyContent: "center",
  },
});
