package com.dike.planning.domain;

import java.time.Instant;

public record RidePost(
    String id,
    String ownerId,
    Type type,
    String sourceId,
    long sourceVersion,
    Status status,
    String visibility,
    String communityId,
    String originLabel,
    String destinationLabel,
    String vehicleType,
    String routeId,
    Instant departureAt,
    Instant expiresAt,
    String note,
    long version,
    long termsVersion,
    String closureReason,
    Instant publishedAt) {
  public enum Type {
    NEED_RIDE,
    OFFER_RIDE
  }

  public enum Status {
    DRAFT,
    OPEN,
    MATCHED,
    CLOSED,
    EXPIRED,
    CANCELLED
  }

  public RidePost change(Status next, String reason, Instant now) {
    return new RidePost(
        id,
        ownerId,
        type,
        sourceId,
        sourceVersion,
        next,
        visibility,
        communityId,
        originLabel,
        destinationLabel,
        vehicleType,
        routeId,
        departureAt,
        expiresAt,
        note,
        version + 1,
        termsVersion,
        reason,
        next == Status.OPEN && publishedAt == null ? now : publishedAt);
  }

  public boolean live(Instant now) {
    return status == Status.OPEN && now.isBefore(expiresAt);
  }
}
