package com.dike.planning;

import java.time.Instant;
import java.util.Optional;

/** Stage 7/8 integration. Only server-owned snapshots may implement this interface. */
public interface JourneySources {
  default boolean available() {
    return false;
  }

  @io.swagger.v3.oas.annotations.media.Schema(name = "PostSource")
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
      String id,
      long version,
      Instant expiresAt,
      long distanceMeters,
      long durationSeconds,
      String originLabel,
      String destinationLabel,
      String vehicleType) {}

  /** Local immutable Mongo snapshots only; no provider/network I/O inside command transactions. */
  Optional<Intent> intent(String actor, String id);

  Optional<Route> route(String actor, String id);

  default void commitIntent(String actor, String id, long version, String state) {
    throw new com.dike.shared.api.ApiException(
        org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,
        "JOURNEY_SOURCE_UNAVAILABLE",
        "Chưa thể xác nhận nhu cầu di chuyển");
  }

  default void releaseIntent(String actor, String id) {}
}
