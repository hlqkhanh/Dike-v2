package com.dike.planning.domain;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Set;

public record ScheduleRule(
    String id,
    String ownerUserId,
    String name,
    ActivityCategory activityCategory,
    Set<DayOfWeek> weekdays,
    LocalDate effectiveFrom,
    LocalDate effectiveUntil,
    LocalTime startLocalTime,
    LocalTime endLocalTime,
    String zoneId,
    PlaceSnapshot activityPlace,
    PlaceSnapshot usualOrigin,
    int arrivalBufferMinutes,
    Set<ScheduleDirection> directions,
    TravelRole defaultTravelRole,
    ScheduleVisibility visibility,
    ScheduleStatus status,
    long version,
    Instant createdAt,
    Instant updatedAt) {

  public static final String V1_ZONE = "Asia/Ho_Chi_Minh";

  public ScheduleRule {
    requireText(id, "id");
    requireText(ownerUserId, "ownerUserId");
    name = normalizeName(name);
    if (activityCategory == null) throw required("activityCategory");
    weekdays = weekdays == null ? Set.of() : Set.copyOf(weekdays);
    if (weekdays.isEmpty()) throw new IllegalArgumentException("weekdays must not be empty");
    if (effectiveFrom == null) throw required("effectiveFrom");
    if (effectiveUntil != null && effectiveUntil.isBefore(effectiveFrom)) {
      throw new IllegalArgumentException("effectiveUntil must not precede effectiveFrom");
    }
    if (startLocalTime == null || endLocalTime == null || !endLocalTime.isAfter(startLocalTime)) {
      throw new IllegalArgumentException(
          "endLocalTime must be after startLocalTime on the same day");
    }
    if (!V1_ZONE.equals(zoneId)) {
      throw new IllegalArgumentException("Only Asia/Ho_Chi_Minh is supported");
    }
    ZoneId.of(zoneId);
    if (activityPlace == null) throw required("activityPlace");
    if (usualOrigin == null) throw required("usualOrigin");
    if (arrivalBufferMinutes < 0 || arrivalBufferMinutes > 180) {
      throw new IllegalArgumentException("arrivalBufferMinutes must be between 0 and 180");
    }
    directions = directions == null ? Set.of() : Set.copyOf(directions);
    if (directions.isEmpty()) throw new IllegalArgumentException("directions must not be empty");
    if (defaultTravelRole == null) throw required("defaultTravelRole");
    if (visibility == null) throw required("visibility");
    if (status == null) throw required("status");
    if (version < 0) throw new IllegalArgumentException("version must not be negative");
    if (createdAt == null || updatedAt == null) throw required("timestamps");
  }

  public boolean appliesOn(LocalDate date) {
    return status == ScheduleStatus.ACTIVE
        && !date.isBefore(effectiveFrom)
        && (effectiveUntil == null || !date.isAfter(effectiveUntil))
        && weekdays.contains(date.getDayOfWeek());
  }

  private static String normalizeName(String value) {
    requireText(value, "name");
    String normalized = value.strip().replaceAll("\\s+", " ");
    if (normalized.codePointCount(0, normalized.length()) > 80) {
      throw new IllegalArgumentException("name must not exceed 80 characters");
    }
    return normalized;
  }

  private static void requireText(String value, String field) {
    if (value == null || value.isBlank()) throw required(field);
  }

  private static IllegalArgumentException required(String field) {
    return new IllegalArgumentException(field + " is required");
  }
}
