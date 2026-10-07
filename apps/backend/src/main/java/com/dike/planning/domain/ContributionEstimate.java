package com.dike.planning.domain;

import java.time.Instant;

public record ContributionEstimate(
    String estimateId,
    String routeSnapshotId,
    long sharedDistanceMeters,
    long suggestedPerKmVnd,
    long amountVnd,
    boolean demo,
    Instant calculatedAt,
    Instant expiresAt) {

  public ContributionEstimate {
    if (estimateId == null
        || estimateId.isBlank()
        || routeSnapshotId == null
        || routeSnapshotId.isBlank()) {
      throw new IllegalArgumentException("Estimate identity is required");
    }
    if (sharedDistanceMeters < 0 || suggestedPerKmVnd < 0 || amountVnd < 0) {
      throw new IllegalArgumentException("Estimate amounts must not be negative");
    }
    if (calculatedAt == null || expiresAt == null || !expiresAt.isAfter(calculatedAt)) {
      throw new IllegalArgumentException("Estimate expiry is invalid");
    }
  }
}
