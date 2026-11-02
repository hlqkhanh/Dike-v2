import type {
  RidePostResponse,
  RidePostView,
  RoutePoint,
} from "@dike/api-client-ts";
import { splitPlaceLabel } from "./place-label";

export function responsePlaces(post: RidePostView, response: RidePostResponse) {
  const lines =
    post.type === "NEED_RIDE" ? (response.message ?? "").split("\n") : [];
  const saved = (prefix: string) =>
    lines
      .find((line) => line.startsWith(prefix))
      ?.slice(prefix.length)
      .trim();
  return {
    pickup: response.pickupCheck?.pickup?.displayLabel ?? saved("Điểm đi: "),
    dropoff:
      response.pickupCheck?.dropoff?.displayLabel ??
      response.pickupCheck?.destinationLabel ??
      saved("Điểm đến: "),
    message: lines.length
      ? lines
          .filter(
            (line) =>
              !line.startsWith("Điểm đi: ") && !line.startsWith("Điểm đến: "),
          )
          .join("\n")
          .trim()
      : response.message,
  };
}

type Member = { id: string; name: string; avatarUrl?: string | null };
export type JourneyStop = {
  kind: "origin" | "destination";
  label: string;
  point?: RoutePoint;
  order: number;
  members: Member[];
};

const normalized = (label: string) =>
  label.trim().toLocaleLowerCase("vi").replace(/\s+/g, " ");
function samePlace(a: JourneyStop, b: JourneyStop) {
  if (a.kind !== b.kind) return false;
  if (a.point && b.point) {
    const lat = (a.point.latitude - b.point.latitude) * 111320;
    const lng =
      (a.point.longitude - b.point.longitude) *
      111320 *
      Math.cos((b.point.latitude * Math.PI) / 180);
    // Match the map's shared-marker tolerance, using the route's snapped coordinates.
    return Math.hypot(lat, lng) < 15;
  }
  const first = splitPlaceLabel(a.label),
    second = splitPlaceLabel(b.label);
  return (
    normalized(a.label) === normalized(b.label) ||
    ((!first.address || !second.address) &&
      normalized(first.name) === normalized(second.name))
  );
}

export function mergedJourneyStops(
  post: RidePostView,
  response: RidePostResponse,
  ownerGeometry: RoutePoint[] = [],
): JourneyStop[] {
  const owner = {
    id: post.ownerId,
    name: post.ownerDisplayName,
    avatarUrl: post.ownerAvatarUrl,
  };
  const requester = {
    id: response.requesterId,
    name: response.requesterDisplayName,
    avatarUrl: response.requesterAvatarUrl,
  };
  const ownerDrives = post.type === "OFFER_RIDE";
  const driver = ownerDrives ? owner : requester;
  const passenger = ownerDrives ? requester : owner;
  const check = response.pickupCheck;
  const points = check?.geometry ?? [];
  const places = responsePlaces(post, response);
  const end = points.length ? points.length - 1 : 3;
  const pickupIndex = check?.pickupIndex ?? 1;
  const dropoffIndex = check?.dropoffIndex ?? 2;
  const at = (index: number) => points[index];
  const candidates: JourneyStop[] = [
    {
      kind: "origin",
      label: ownerDrives ? post.originLabel : places.pickup || post.originLabel,
      point: ownerDrives ? (at(0) ?? ownerGeometry[0]) : at(0),
      order: 0,
      members: [driver],
    },
    {
      kind: "origin",
      label: ownerDrives ? places.pickup || post.originLabel : post.originLabel,
      point: at(pickupIndex) ?? (ownerDrives ? undefined : ownerGeometry[0]),
      order: pickupIndex,
      members: [passenger],
    },
    {
      kind: "destination",
      label: ownerDrives
        ? places.dropoff || post.destinationLabel
        : post.destinationLabel,
      point:
        at(dropoffIndex) ??
        (ownerDrives ? undefined : ownerGeometry[ownerGeometry.length - 1]),
      order: dropoffIndex,
      members: [passenger],
    },
    {
      kind: "destination",
      label: ownerDrives
        ? post.destinationLabel
        : places.dropoff || post.destinationLabel,
      point: ownerDrives
        ? (at(end) ?? ownerGeometry[ownerGeometry.length - 1])
        : at(end),
      order: end,
      members: [driver],
    },
  ];
  const result: JourneyStop[] = [];
  for (const candidate of candidates) {
    const existing = result.find((stop) => samePlace(stop, candidate));
    if (existing) {
      for (const member of candidate.members) {
        if (!existing.members.some((value) => value.id === member.id))
          existing.members.push(member);
      }
      if (
        splitPlaceLabel(candidate.label).address.length >
        splitPlaceLabel(existing.label).address.length
      )
        existing.label = candidate.label;
    } else result.push(candidate);
  }
  return result.sort((a, b) => a.order - b.order);
}
