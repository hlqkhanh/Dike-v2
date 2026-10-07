package com.dike.ride;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/** Stage 5/8 server-owned evidence; never deserialize these records from request JSON. */
public interface RideResources {
  default boolean available() {
    return false;
  }

  record Vehicle(
      String id, String ownerId, String type, int passengerCapacity, long approvalVersion) {}

  record Quote(
      String id,
      String intentId,
      String tripId,
      String passengerId,
      String driverId,
      long tripTermsVersion,
      long tripRouteVersion,
      String routeId,
      long priceVnd,
      Instant pickupAt,
      Instant dropoffAt,
      Instant expiresAt,
      List<Stop> stops,
      long originalDetourMeters,
      long originalDetourSeconds) {
    public Quote {
      stops = List.copyOf(stops);
    }
  }

  record Stop(String id, String bookingId, String kind, String publicLabel, Instant eta) {}

  Optional<Vehicle> vehicle(String actor, String id);

  Optional<Quote> quote(String actor, String id);

  /**
   * Must verify contribution cap against server fuel/configuration, never a client-supplied cap.
   */
  boolean contributionAllowed(Vehicle vehicle, long perKm);

  /** Joins the transaction; implemented with approval/config version checks by Stage 5/8. */
  void fenceVehicle(String id, long approvalVersion);
}
