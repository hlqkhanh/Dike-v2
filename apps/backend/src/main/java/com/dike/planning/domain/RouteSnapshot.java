package com.dike.planning.domain;

import java.time.Instant;
import java.util.List;

public record RouteSnapshot(
    String id,
    String ownerUserId,
    String provider,
    String providerRouteId,
    VehicleMode vehicleMode,
    PlaceSnapshot origin,
    PlaceSnapshot destination,
    long distanceMeters,
    long durationSeconds,
    List<RoutePoint> geometry,
    Instant calculatedAt,
    Instant expiresAt,
    long version) {

  public RouteSnapshot {
    if (id == null || id.isBlank() || ownerUserId == null || ownerUserId.isBlank()) {
      throw new IllegalArgumentException("Route identity is required");
    }
    if (provider == null || provider.isBlank() || vehicleMode == null) {
      throw new IllegalArgumentException("Route provider and vehicle mode are required");
    }
    if (origin == null || destination == null) {
      throw new IllegalArgumentException("Route places are required");
    }
    geometry = geometry == null ? List.of() : List.copyOf(geometry);
    if (distanceMeters < 0 || durationSeconds < 0 || geometry.size() < 2) {
      throw new IllegalArgumentException("Route metrics and geometry are invalid");
    }
    if (calculatedAt == null || expiresAt == null || !expiresAt.isAfter(calculatedAt)) {
      throw new IllegalArgumentException("Route expiry is invalid");
    }
    if (version < 0) throw new IllegalArgumentException("version must not be negative");
  }
}
