package com.dike.planning.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Set;
import org.junit.jupiter.api.Test;

class ScheduleRuleTest {

  private static final Instant NOW = Instant.parse("2026-10-07T00:00:00Z");

  @Test
  void acceptsVietnamScheduleAndNormalizesName() {
    ScheduleRule schedule = schedule("  Ca   sáng  ");

    assertThat(schedule.name()).isEqualTo("Ca sáng");
    assertThat(schedule.appliesOn(LocalDate.parse("2026-10-12"))).isTrue();
    assertThat(schedule.appliesOn(LocalDate.parse("2026-10-13"))).isFalse();
  }

  @Test
  void rejectsOvernightUnsupportedZoneAndInvalidBuffer() {
    assertThatThrownBy(
            () ->
                new ScheduleRule(
                    "schedule-1",
                    "user-1",
                    "Night",
                    ActivityCategory.WORK,
                    Set.of(DayOfWeek.MONDAY),
                    LocalDate.parse("2026-10-07"),
                    null,
                    LocalTime.of(22, 0),
                    LocalTime.of(6, 0),
                    ScheduleRule.V1_ZONE,
                    place("office"),
                    place("home"),
                    0,
                    Set.of(ScheduleDirection.OUTBOUND),
                    TravelRole.RIDER,
                    ScheduleVisibility.PRIVATE,
                    ScheduleStatus.ACTIVE,
                    0,
                    NOW,
                    NOW))
        .hasMessageContaining("same day");
    assertThatThrownBy(() -> withZone("UTC")).hasMessageContaining("Asia/Ho_Chi_Minh");
    assertThatThrownBy(() -> withBuffer(181)).hasMessageContaining("between 0 and 180");
  }

  private ScheduleRule withZone(String zone) {
    ScheduleRule value = schedule("Schedule");
    return new ScheduleRule(
        value.id(),
        value.ownerUserId(),
        value.name(),
        value.activityCategory(),
        value.weekdays(),
        value.effectiveFrom(),
        value.effectiveUntil(),
        value.startLocalTime(),
        value.endLocalTime(),
        zone,
        value.activityPlace(),
        value.usualOrigin(),
        value.arrivalBufferMinutes(),
        value.directions(),
        value.defaultTravelRole(),
        value.visibility(),
        value.status(),
        value.version(),
        value.createdAt(),
        value.updatedAt());
  }

  private ScheduleRule withBuffer(int buffer) {
    ScheduleRule value = schedule("Schedule");
    return new ScheduleRule(
        value.id(),
        value.ownerUserId(),
        value.name(),
        value.activityCategory(),
        value.weekdays(),
        value.effectiveFrom(),
        value.effectiveUntil(),
        value.startLocalTime(),
        value.endLocalTime(),
        value.zoneId(),
        value.activityPlace(),
        value.usualOrigin(),
        buffer,
        value.directions(),
        value.defaultTravelRole(),
        value.visibility(),
        value.status(),
        value.version(),
        value.createdAt(),
        value.updatedAt());
  }

  private ScheduleRule schedule(String name) {
    return new ScheduleRule(
        "schedule-1",
        "user-1",
        name,
        ActivityCategory.STUDY,
        Set.of(DayOfWeek.MONDAY),
        LocalDate.parse("2026-10-07"),
        LocalDate.parse("2026-12-31"),
        LocalTime.of(8, 0),
        LocalTime.of(10, 0),
        ScheduleRule.V1_ZONE,
        place("school"),
        place("home"),
        15,
        Set.of(ScheduleDirection.OUTBOUND, ScheduleDirection.RETURN),
        TravelRole.RIDER,
        ScheduleVisibility.PRIVATE,
        ScheduleStatus.ACTIVE,
        0,
        NOW,
        NOW);
  }

  private PlaceSnapshot place(String id) {
    return new PlaceSnapshot("GOONG", id, id, "Quận 1", 106.7, 10.77, NOW);
  }
}
