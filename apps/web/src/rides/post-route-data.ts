import type { RidePostResponse, RoutePoint } from "@dike/api-client-ts";

const confirmed = (response: RidePostResponse) =>
  ["ACCEPTED", "DRIVER_STARTED", "DRIVER_ARRIVED", "COMPLETED"].includes(
    response.status,
  );

export const sharesPostEndpoints = (response?: RidePostResponse) =>
  Boolean(
    response &&
      confirmed(response) &&
      response.action === "REQUEST_RIDE" &&
      !response.pickupCheck,
  );

export function sharedEndpointStops(
  geometry: RoutePoint[],
  origin: string,
  destination: string,
) {
  if (geometry.length < 2) return undefined;
  return {
    pickup: { ...geometry[0], displayLabel: origin },
    pickupIndex: 0,
    dropoff: { ...geometry[geometry.length - 1], displayLabel: destination },
    dropoffIndex: geometry.length - 1,
  };
}

export function responseForRoute(
  responses: RidePostResponse[],
  ownerId: string,
  viewerId?: string,
  selectedId?: string | null,
) {
  const visible =
    viewerId === ownerId
      ? responses
      : responses.filter((response) => response.requesterId === viewerId);
  return (
    visible.find(
      (response) => response.id === selectedId && response.pickupCheck,
    ) ?? visible.find(confirmed)
  );
}

type Coordinate = [number, number];
export function journeyRouteSegments(
  coordinates: Coordinate[],
  pickupIndex?: number,
  dropoffIndex?: number,
  routeColor = "#07966e",
) {
  if (
    pickupIndex === undefined ||
    pickupIndex < 0 ||
    pickupIndex >= coordinates.length
  ) {
    return [{ coordinates, color: routeColor }];
  }
  const end =
    dropoffIndex !== undefined &&
    dropoffIndex >= pickupIndex &&
    dropoffIndex < coordinates.length
      ? dropoffIndex
      : coordinates.length - 1;
  return [
    { coordinates: coordinates.slice(0, pickupIndex + 1), color: "#e9bd52" },
    { coordinates: coordinates.slice(pickupIndex, end + 1), color: "#2563eb" },
    { coordinates: coordinates.slice(end), color: "#07966e" },
  ].filter((segment) => segment.coordinates.length >= 2);
}
