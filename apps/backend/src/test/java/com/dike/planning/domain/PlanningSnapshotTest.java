package com.dike.planning.domain;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Set;
import org.junit.jupiter.api.Test;

class PlanningSnapshotTest {

  private static final Instant NOW = Instant.parse("2026-10-07T00:00:00Z");

  @Test
  void skipCannotCarryOverrides() {
    assertThatThrownBy(
            () ->
                new ScheduleException(
                    "exception-1",
                    "schedule-1",
                    "user-1",
                    LocalDate.parse("2026-10-12"),
                    ScheduleExceptionType.SKIP,
                    LocalTime.of(9, 0),
                    LocalTime.of(10, 0),
                    null,
                    null,
                    Set.of(),
                    0,
                    NOW,
                    NOW))
        .hasMessageContaining("must not contain override");
  }

  @Test
  void intentRequiresDirectionSpecificTimeBoundary() {
    assertThatThrownBy(
            () ->
                new TravelIntent(
                    "intent-1",
                    "user-1",
                    TravelIntentSourceType.SCHEDULE,
                    "schedule-1",
                    0,
                    LocalDate.parse("2026-10-12"),
                    ScheduleDirection.OUTBOUND,
                    TravelRole.RIDER,
                    place("home"),
                    place("school"),
                    null,
                    null,
                    TravelIntentCommitmentState.PRIVATE,
                    false,
                    0,
                    null,
                    NOW,
                    NOW))
        .hasMessageContaining("arrivalDeadlineAt");
  }

  @Test
  void placeRejectsInvalidCoordinates() {
    assertThatThrownBy(() -> new PlaceSnapshot("GOONG", "place", "Place", "Area", 181, 10, NOW))
        .hasMessageContaining("longitude");
  }

  private PlaceSnapshot place(String id) {
    return new PlaceSnapshot("GOONG", id, id, "Quận 1", 106.7, 10.77, NOW);
  }
}
