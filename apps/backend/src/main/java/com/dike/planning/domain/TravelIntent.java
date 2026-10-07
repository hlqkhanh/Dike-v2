package com.dike.planning.domain;

import java.time.Instant;
import java.time.LocalDate;

public record TravelIntent(
    String id,
    String ownerUserId,
    TravelIntentSourceType sourceType,
    String scheduleId,
    long sourceVersion,
    LocalDate localDate,
    ScheduleDirection direction,
    TravelRole travelRole,
    PlaceSnapshot origin,
    PlaceSnapshot destination,
    Instant earliestDepartureAt,
    Instant arrivalDeadlineAt,
    TravelIntentCommitmentState commitmentState,
    boolean sourceChanged,
    long version,
    String matchedWithUserId,
    Instant createdAt,
    Instant updatedAt) {

  public TravelIntent {
    requireText(id, "id");
    requireText(ownerUserId, "ownerUserId");
    if (sourceType == null) throw required("sourceType");
    if (sourceType == TravelIntentSourceType.SCHEDULE) requireText(scheduleId, "scheduleId");
    if (sourceType == TravelIntentSourceType.MANUAL && scheduleId != null) {
      throw new IllegalArgumentException("Manual intent must not reference a schedule");
    }
    if (sourceVersion < 0) throw new IllegalArgumentException("sourceVersion must not be negative");
    if (localDate == null) throw required("localDate");
    if (direction == null) throw required("direction");
    if (travelRole == null) throw required("travelRole");
    if (origin == null || destination == null) throw required("places");
    if (direction == ScheduleDirection.OUTBOUND && arrivalDeadlineAt == null) {
      throw required("arrivalDeadlineAt");
    }
    if (direction == ScheduleDirection.RETURN && earliestDepartureAt == null) {
      throw required("earliestDepartureAt");
    }
    if (commitmentState == null) throw required("commitmentState");
    if (version < 0) throw new IllegalArgumentException("version must not be negative");
    if (createdAt == null || updatedAt == null) throw required("timestamps");
  }

  private static void requireText(String value, String field) {
    if (value == null || value.isBlank()) throw required(field);
  }

  private static IllegalArgumentException required(String field) {
    return new IllegalArgumentException(field + " is required");
  }
}
