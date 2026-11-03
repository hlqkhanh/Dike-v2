import { describe, expect, it } from "vitest";
import type { RidePostResponse } from "@dike/api-client-ts";
import {
  journeyRouteSegments,
  responseForRoute,
  sharesPostEndpoints,
  sharedEndpointStops,
} from "./post-route-data";

const response = (
  id: string,
  requesterId: string,
  status = "ACCEPTED",
  pickupCheck = {},
) =>
  ({
    id,
    requesterId,
    ownerId: "driver",
    status,
    pickupCheck,
  }) as RidePostResponse;

describe("matched post map selection", () => {
  const rows = [
    response("pending", "waiting", "PENDING"),
    response("match", "passenger"),
  ];
  it("shows the accepted journey automatically to both participants", () => {
    expect(responseForRoute(rows, "driver", "driver")?.id).toBe("match");
    expect(responseForRoute(rows, "driver", "passenger")?.id).toBe("match");
  });
  it("keeps an explicitly selected pending route preview for the owner", () => {
    expect(responseForRoute(rows, "driver", "driver", "pending")?.id).toBe(
      "pending",
    );
    expect(responseForRoute(rows, "driver", "driver", "missing")?.id).toBe(
      "match",
    );
  });
  it("never displays another requester's journey or auto-selects pending requests", () => {
    expect(
      responseForRoute(rows, "driver", "waiting", "match"),
    ).toBeUndefined();
    expect(responseForRoute(rows, "driver", "stranger")).toBeUndefined();
    expect(responseForRoute(rows, "driver", undefined)).toBeUndefined();
  });
  it("keeps both participants' completed journey visible", () => {
    const completed = [response("done", "passenger", "COMPLETED")];
    expect(responseForRoute(completed, "driver", "passenger")?.id).toBe("done");
  });
});

describe("merged route segments", () => {
  const points: [number, number][] = [
    [106, 10],
    [106.1, 10.1],
    [106.2, 10.2],
    [106.3, 10.3],
    [106.4, 10.4],
  ];
  it("preserves the driver's route after dropping the passenger off", () => {
    expect(journeyRouteSegments(points, 1, 3)).toEqual([
      { coordinates: points.slice(0, 2), color: "#e9bd52" },
      { coordinates: points.slice(1, 4), color: "#2563eb" },
      { coordinates: points.slice(3), color: "#07966e" },
    ]);
  });
  it("supports shared endpoints without drawing zero-length legs", () => {
    expect(journeyRouteSegments(points, 0, 4)).toEqual([
      { coordinates: points, color: "#2563eb" },
    ]);
  });
  it("supports legacy checks with a shared destination", () => {
    expect(journeyRouteSegments(points, 2)).toEqual([
      { coordinates: points.slice(0, 3), color: "#e9bd52" },
      { coordinates: points.slice(2), color: "#2563eb" },
    ]);
  });
  it("leaves unmatched routes intact", () => {
    expect(journeyRouteSegments(points)).toEqual([
      { coordinates: points, color: "#07966e" },
    ]);
    expect(journeyRouteSegments(points, -1)).toEqual(
      journeyRouteSegments(points),
    );
  });
});

describe("accepted requests without custom pickup addresses", () => {
  const sameEndpoints = {
    ...response("same-endpoints", "passenger"),
    action: "REQUEST_RIDE" as const,
    pickupCheck: null,
  };
  it("selects and identifies the screenshot's accepted request with no pickup check", () => {
    for (const viewer of ["driver", "passenger"]) {
      const selected = responseForRoute([sameEndpoints], "driver", viewer);
      expect(selected?.id).toBe("same-endpoints");
      expect(sharesPostEndpoints(selected)).toBe(true);
    }
  });
  it("uses the real post geometry for both shared endpoints", () => {
    const geometry = [
      { longitude: 105.8, latitude: 21 },
      { longitude: 107, latitude: 18 },
      { longitude: 109.2, latitude: 13.7 },
    ];
    const stops = sharedEndpointStops(geometry, "Hà Nội", "Quy Nhơn")!;
    expect(stops.pickup).toEqual({ ...geometry[0], displayLabel: "Hà Nội" });
    expect(stops.dropoff).toEqual({ ...geometry[2], displayLabel: "Quy Nhơn" });
    expect(
      journeyRouteSegments(
        geometry.map((p) => [p.longitude, p.latitude]),
        stops.pickupIndex,
        stops.dropoffIndex,
      ),
    ).toEqual([
      {
        coordinates: geometry.map((p) => [p.longitude, p.latitude]),
        color: "#2563eb",
      },
    ]);
  });
  it("does not invent shared endpoints for offers or pending requests", () => {
    expect(
      sharesPostEndpoints({ ...sameEndpoints, action: "OFFER_RIDE" }),
    ).toBe(false);
    expect(sharesPostEndpoints({ ...sameEndpoints, status: "PENDING" })).toBe(
      false,
    );
    expect(sharesPostEndpoints(undefined)).toBe(false);
    expect(sharedEndpointStops([], "A", "B")).toBeUndefined();
  });
});
