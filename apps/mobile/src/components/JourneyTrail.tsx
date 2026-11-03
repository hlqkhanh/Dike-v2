import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, StyleSheet, View } from "react-native";
import type {
  RidePostResponse,
  RidePostView,
  RoutePoint,
} from "@dike/api-client-ts";
import { mergedJourneyStops } from "@/core/journey-stops";
import { splitPlaceLabel } from "@/core/place-label";
import { theme } from "@/core/theme";
import { Avatar, Icon, Text, type IconName } from "./ui";
import { LinearGradient } from "expo-linear-gradient";
import { JourneyCardArt, type JourneyArtKind } from "./JourneyCardArt";
import { JourneyGlass } from "./JourneyGlass";
import journeyRider from "../../assets/art/journey-mascot-v2.png";
import { useReducedMotion } from "@/core/accessibility";

type Milestone = {
  title: string;
  caption: string;
  address?: string;
  icon: IconName;
  stage: number;
  art?: JourneyArtKind;
  direction?: "origin" | "destination";
  state?: string;
  members?: { id: string; name: string; avatarUrl?: string | null }[];
};
const stageByStatus: Record<string, number> = {
  ACCEPTED: 0,
  DRIVER_STARTED: 1,
  DRIVER_ARRIVED: 2,
  COMPLETED: 3,
};

export function JourneyTrail({
  post,
  response,
  geometry,
  paid,
}: {
  post: RidePostView;
  response: RidePostResponse;
  geometry?: RoutePoint[];
  paid: boolean;
}) {
  const [width, setWidth] = useState(360);
  const [cardHeights, setCardHeights] = useState<Record<number, number>>({});
  const reducedMotion = useReducedMotion();
  const riderY = useRef(new Animated.Value(0)).current;
  const riderInitialized = useRef(false);
  const stops = mergedJourneyStops(post, response, geometry);
  const current = paid ? 4 : (stageByStatus[response.status] ?? 0);
  const passengerId =
    post.type === "OFFER_RIDE" ? response.requesterId : post.ownerId;
  const stopMilestones: Milestone[] = stops.map((stop, index) => {
    const place = splitPlaceLabel(stop.label);
    return {
      title: place.name,
      address: place.address,
      caption: `${stop.kind === "origin" ? "Điểm đi" : "Điểm đến"} · ${stop.members.length > 1 ? "Cả hai" : stop.members[0].name}`,
      art:
        stop.members.length > 1
          ? "shared"
          : stop.members[0].id === passengerId
            ? "passenger"
            : "driver",
      icon: (stop.kind === "origin" ? "navigate" : "flag") as IconName,
      stage:
        stop.kind === "destination"
          ? 3
          : stop.members.length > 1 || index > 0
            ? 2
            : 1,
      state: stop.members.some((member) => member.id === passengerId)
        ? stop.kind === "origin"
          ? "DRIVER_ARRIVED"
          : "COMPLETED"
        : undefined,
      direction: stop.kind,
      members: stop.members,
    };
  });
  const milestones: Milestone[] = [
    {
      title: "Đã xác nhận",
      caption: "",
      icon: "checkmark",
      stage: 0,
      state: "ACCEPTED",
      art: "confirmed",
    },
    {
      title: "Đang đến đón",
      caption: "",
      icon: "navigate",
      stage: 1,
      state: "DRIVER_STARTED",
      art: "pickup",
    },
    ...stopMilestones,
    {
      title: paid ? "Đã thanh toán" : "Thanh toán",
      caption: "",
      icon: "card-outline",
      stage: 4,
      state: "PAYMENT",
      art: "payment",
    },
  ];
  let trailOffset = 16;
  let previousCenter = -Infinity;
  const points = milestones.map((milestone, index) => {
    const cardHeight = cardHeights[index] ?? (milestone.members ? 110 : 56);
    const center = Math.max(trailOffset + cardHeight / 2, previousCenter + 100);
    const point = {
      x: Math.max(42, Math.min(56, width * 0.13)),
      y: center,
    };
    previousCenter = center;
    trailOffset = center + cardHeight / 2 + 36;
    return point;
  });
  const height = trailOffset;
  const activeIndex = Math.max(
    0,
    milestones.findIndex(
      (milestone) => milestone.state && milestone.stage === current,
    ),
  );
  const riderTarget =
    points[activeIndex].y - (milestones[activeIndex].members ? 88 : 50);
  useEffect(() => {
    if (!riderInitialized.current || reducedMotion) {
      riderY.setValue(riderTarget);
      riderInitialized.current = true;
      return;
    }
    const animation = Animated.timing(riderY, {
      toValue: riderTarget,
      duration: 850,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [riderTarget, riderY, reducedMotion]);
  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.landscape, { height }]}
      testID="journey-trail"
    >
      <View
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        accessible={false}
      >
        <View
          testID="journey-vertical-path"
          style={{
            position: "absolute",
            left: points[0].x - 6,
            top: points[0].y,
            width: 12,
            height: points[points.length - 1].y - points[0].y,
            borderRadius: 6,
            backgroundColor: "#fffef6",
            overflow: "hidden",
          }}
        >
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 4,
              width: 4,
              height: Math.max(0, points[activeIndex].y - points[0].y),
              backgroundColor: "#a8cfb7",
              borderRadius: 2,
            }}
          />
          {Array.from(
            {
              length: Math.ceil(
                (points[points.length - 1].y - points[0].y) / 22,
              ),
            },
            (_, index) => (
              <View
                key={index}
                style={{
                  position: "absolute",
                  top: index * 22,
                  left: 5,
                  width: 2,
                  height: 10,
                  borderRadius: 1,
                  backgroundColor: "rgba(116,145,118,0.25)",
                }}
              />
            ),
          )}
        </View>
      </View>
      <View testID="merged-journey-stops" style={StyleSheet.absoluteFill}>
        {milestones.map((milestone, index) => {
          const point = points[index];
          const complete = current >= milestone.stage;
          const isStatus = !milestone.members;
          const active = index === activeIndex;
          const left = point.x + 28;
          const cardWidth = width - left - 14;
          const cardHeight = cardHeights[index] ?? (isStatus ? 56 : 110);
          return (
            <View
              key={index}
              testID={
                milestone.members
                  ? "merged-journey-stop"
                  : "journey-state-" + milestone.state
              }
              style={[
                styles.milestone,
                {
                  top: point.y - 22,
                  left: 0,
                  width,
                  height: cardHeight,
                },
              ]}
            >
              <View
                style={[
                  styles.marker,
                  { position: "absolute", left: point.x - 22, top: 0 },
                  complete && isStatus && styles.markerComplete,
                  active && styles.activeMarker,
                  active && isStatus && { opacity: 0 },
                ]}
              >
                {milestone.members ? (
                  <View style={styles.avatars}>
                    {milestone.members.map((member, memberIndex) => (
                      <View
                        key={member.id}
                        style={{ marginLeft: memberIndex ? -10 : 0 }}
                      >
                        <Avatar
                          userId={member.id}
                          name={member.name}
                          uri={member.avatarUrl}
                          size={30}
                        />
                      </View>
                    ))}
                  </View>
                ) : (
                  <Icon
                    name={milestone.icon}
                    size={20}
                    color={complete ? "#fff" : theme.colors.inkMuted}
                  />
                )}
              </View>
              <View
                onLayout={(event) => {
                  const measured = Math.ceil(event.nativeEvent.layout.height);
                  setCardHeights((previous) =>
                    previous[index] === measured
                      ? previous
                      : { ...previous, [index]: measured },
                  );
                }}
                accessibilityLabel={
                  isStatus
                    ? milestone.title
                    : `${milestone.title}${milestone.members ? " · " + milestone.members.map((member) => member.name).join(", ") : ""}. ${milestone.address ?? ""}`
                }
                style={[
                  styles.stopCard,
                  active && styles.activeCard,
                  {
                    position: "absolute",
                    left,
                    top: 22 - cardHeight / 2,
                    width: cardWidth,
                    paddingLeft: 16,
                  },
                  isStatus && styles.statusCard,
                ]}
              >
                <JourneyGlass radius={26} />
                <LinearGradient
                  pointerEvents="none"
                  colors={
                    milestone.art === "pickup" ||
                    milestone.art === "arrived" ||
                    milestone.art === "passenger"
                      ? ["rgba(255,255,246,0.78)", "rgba(255,242,179,0.66)"]
                      : milestone.art === "payment"
                        ? ["rgba(246,253,255,0.78)", "rgba(216,233,255,0.62)"]
                        : milestone.art === "shared"
                          ? ["rgba(247,255,255,0.8)", "rgba(209,242,253,0.64)"]
                          : ["rgba(249,255,251,0.82)", "rgba(207,245,222,0.68)"]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[StyleSheet.absoluteFill, { borderRadius: 26 }]}
                />
                <View style={styles.copy}>
                  {!isStatus ? (
                    <View style={styles.placeHeading}>
                      <Text style={styles.caption}>
                        {milestone.direction === "origin"
                          ? "Điểm đi"
                          : "Điểm đến"}{" "}
                        ·{" "}
                        {milestone.members && milestone.members.length === 1 ? (
                          <Text
                            userId={milestone.members[0].id}
                            style={styles.caption}
                          >
                            {milestone.members[0].name}
                          </Text>
                        ) : (
                          "Cả hai"
                        )}
                      </Text>
                      {milestone.state && complete ? (
                        <Icon
                          name="checkmark-circle"
                          size={15}
                          color={theme.colors.primary}
                        />
                      ) : null}
                    </View>
                  ) : null}
                  <Text
                    style={[
                      styles.place,
                      isStatus && styles.statusText,
                      isStatus && !complete && styles.upcomingStatus,
                    ]}
                  >
                    {milestone.title}
                  </Text>
                  {milestone.address ? (
                    <Text style={styles.address}>{milestone.address}</Text>
                  ) : null}
                </View>
                {isStatus ? (
                  <View style={styles.compactArt}>
                    <View style={styles.compactArtInner}>
                      <JourneyCardArt
                        kind={milestone.art ?? "place"}
                        direction={milestone.direction}
                      />
                    </View>
                  </View>
                ) : (
                  <JourneyCardArt
                    kind={milestone.art ?? "place"}
                    direction={milestone.direction}
                  />
                )}
              </View>
            </View>
          );
        })}
      </View>
      <Animated.Image
        testID="journey-rider"
        accessibilityLabel={"Vị trí hiện tại: " + milestones[activeIndex].title}
        accessibilityValue={{ text: paid ? "PAYMENT" : response.status }}
        source={journeyRider}
        resizeMode="contain"
        style={{
          position: "absolute",
          top: 0,
          left: points[0].x - 28,
          width: 56,
          height: 72,
          transform: [{ translateY: riderY }],
          zIndex: 2,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  landscape: { backgroundColor: "transparent" },
  roadDash: {
    position: "absolute",
    top: 5,
    height: 1,
    left: 0,
    right: 0,
    backgroundColor: "#e5e9d9",
  },
  compactArt: { width: 52, height: 54 },
  compactArtInner: {
    position: "absolute",
    left: -7,
    top: -8,
    transform: [{ scale: 0.78 }],
  },
  statusCard: { paddingVertical: 6, minHeight: 56 },
  copy: { flex: 1, minWidth: 0, gap: 3, zIndex: 1 },
  statusText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: "#0c3f32",
  },
  upcomingStatus: { color: "#164b3d", fontWeight: "700" },
  placeHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  traveled: {
    position: "absolute",
    top: 5,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#b2d6be",
  },
  milestone: { position: "absolute", gap: 8 },
  marker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    borderWidth: 3,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadow.card,
  },
  markerComplete: { backgroundColor: theme.colors.primary },
  activeMarker: { borderColor: "#e3f4eb", shadowOpacity: 0.06 },
  avatars: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  stopCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 26,
    shadowColor: "#508f71",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 3,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 7,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
  },
  activeCard: {
    borderColor: "#ffffff",
    backgroundColor: "rgba(232,255,243,0.14)",
  },
  caption: {
    flex: 1,
    fontSize: 10,
    lineHeight: 15,
    color: theme.colors.inkMuted,
  },
  place: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: theme.colors.ink,
  },
  address: { fontSize: 11, lineHeight: 16, color: theme.colors.inkMuted },
});
