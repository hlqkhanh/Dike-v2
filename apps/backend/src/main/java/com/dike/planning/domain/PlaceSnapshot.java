package com.dike.planning.domain;

import java.time.Instant;

public record PlaceSnapshot(
    String provider,
    String providerPlaceId,
    String displayLabel,
    String publicAreaLabel,
    double longitude,
    double latitude,
    Instant resolvedAt) {

  public PlaceSnapshot {
    requireText(provider, "provider");
    requireText(providerPlaceId, "providerPlaceId");
    requireText(displayLabel, "displayLabel");
    requireText(publicAreaLabel, "publicAreaLabel");
    if (!Double.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new IllegalArgumentException("longitude must be between -180 and 180");
    }
    if (!Double.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new IllegalArgumentException("latitude must be between -90 and 90");
    }
    if (resolvedAt == null) throw new IllegalArgumentException("resolvedAt is required");
  }

  private static void requireText(String value, String field) {
    if (value == null || value.isBlank())
      throw new IllegalArgumentException(field + " is required");
  }
}
