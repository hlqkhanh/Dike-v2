package com.dike.planning.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Set;

public record ScheduleException(
    String id,
    String scheduleId,
    String ownerUserId,
    LocalDate localDate,
    ScheduleExceptionType type,
    LocalTime startLocalTime,
    LocalTime endLocalTime,
    PlaceSnapshot activityPlace,
    PlaceSnapshot usualOrigin,
    Set<ScheduleDirection> directions,
    long version,
    Instant createdAt,
    Instant updatedAt) {

  public ScheduleException {
    requireText(id, "id");
    requireText(scheduleId, "scheduleId");
    requireText(ownerUserId, "ownerUserId");
    if (localDate == null) throw required("localDate");
    if (type == null) throw required("type");
    if (type == ScheduleExceptionType.SKIP
        && (startLocalTime != null
            || endLocalTime != null
            || activityPlace != null
            || usualOrigin != null
            || (directions != null && !directions.isEmpty()))) {
      throw new IllegalArgumentException("SKIP exception must not contain override values");
    }
    if ((startLocalTime == null) != (endLocalTime == null)) {
      throw new IllegalArgumentException("Override times must be supplied together");
    }
    if (startLocalTime != null && !endLocalTime.isAfter(startLocalTime)) {
      throw new IllegalArgumentException("Override end time must be after start time");
    }
    directions = directions == null ? Set.of() : Set.copyOf(directions);
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
