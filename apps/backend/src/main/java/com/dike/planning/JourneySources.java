package com.dike.planning;

import java.time.Instant;
import java.util.Optional;

/** Stage 7/8 integration. Only server-owned snapshots may implement this interface. */
public interface JourneySources {
  default boolean available() {
    return false;
  }

  record Intent(
      String id,
      String ownerId,
      long version,
      String originLabel,
      String destinationLabel,
      Instant departureAt,
      Instant latestDepartureAt,
      Instant arrivalAt,
      String vehicleType,
      String routeId) {}

  record Route(
      String id, long version, Instant expiresAt, long distanceMeters, long durationSeconds) {}

  /** Local immutable Mongo snapshots only; no provider/network I/O inside command transactions. */
  Optional<Intent> intent(String actor, String id);

  Optional<Route> route(String actor, String id);
}
