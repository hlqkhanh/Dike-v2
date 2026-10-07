package com.dike.planning.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.dike.planning.domain.ActivityCategory;
import com.dike.planning.domain.PlaceSnapshot;
import com.dike.planning.domain.ScheduleDirection;
import com.dike.planning.domain.ScheduleRule;
import com.dike.planning.domain.ScheduleStatus;
import com.dike.planning.domain.ScheduleVisibility;
import com.dike.planning.domain.TravelIntent;
import com.dike.planning.domain.TravelIntentCommitmentState;
import com.dike.planning.domain.TravelIntentSourceType;
import com.dike.planning.domain.TravelRole;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class TravelIntentMaterializerTest {

  private static final Instant NOW = Instant.parse("2026-10-07T00:00:00Z");
  private static final LocalDate MONDAY = LocalDate.parse("2026-10-12");

  @Test
  void createsBothDirectionsUsingVietnamLocalTime() {
    PlanningStore store = mock(PlanningStore.class);
    ScheduleRule schedule = schedule();
    when(store.schedule("schedule-1")).thenReturn(Optional.of(schedule));
    when(store.exceptions("schedule-1", MONDAY, MONDAY)).thenReturn(List.of());
    when(store.scheduledIntent("schedule-1", MONDAY, ScheduleDirection.OUTBOUND))
        .thenReturn(Optional.empty());
    when(store.scheduledIntent("schedule-1", MONDAY, ScheduleDirection.RETURN))
        .thenReturn(Optional.empty());
    var materializer =
        new TravelIntentMaterializer(
            store, Clock.fixed(NOW, ZoneOffset.UTC), new Sequence("intent-1", "intent-2"));

    materializer.materialize("schedule-1", MONDAY, MONDAY);

    ArgumentCaptor<TravelIntent> captor = ArgumentCaptor.forClass(TravelIntent.class);
    verify(store, org.mockito.Mockito.times(2)).insertIntent(captor.capture());
    TravelIntent outbound = captor.getAllValues().getFirst();
    TravelIntent returning = captor.getAllValues().getLast();
    assertThat(outbound.direction()).isEqualTo(ScheduleDirection.OUTBOUND);
    assertThat(outbound.arrivalDeadlineAt()).isEqualTo(Instant.parse("2026-10-12T00:45:00Z"));
    assertThat(returning.direction()).isEqualTo(ScheduleDirection.RETURN);
    assertThat(returning.earliestDepartureAt()).isEqualTo(Instant.parse("2026-10-12T03:00:00Z"));
  }

  @Test
  void repeatedRunDoesNotRewriteEqualPrivateIntent() {
    PlanningStore store = mock(PlanningStore.class);
    ScheduleRule schedule = schedule();
    TravelIntent existing =
        new TravelIntent(
            "intent-1",
            "user-1",
            TravelIntentSourceType.SCHEDULE,
            "schedule-1",
            0,
            MONDAY,
            ScheduleDirection.OUTBOUND,
            TravelRole.RIDER,
            schedule.usualOrigin(),
            schedule.activityPlace(),
            null,
            Instant.parse("2026-10-12T00:45:00Z"),
            TravelIntentCommitmentState.PRIVATE,
            false,
            0,
            null,
            NOW,
            NOW);
    when(store.schedule("schedule-1")).thenReturn(Optional.of(schedule));
    when(store.exceptions("schedule-1", MONDAY, MONDAY)).thenReturn(List.of());
    when(store.scheduledIntent("schedule-1", MONDAY, ScheduleDirection.OUTBOUND))
        .thenReturn(Optional.of(existing));
    when(store.scheduledIntent("schedule-1", MONDAY, ScheduleDirection.RETURN))
        .thenReturn(Optional.empty());
    var materializer =
        new TravelIntentMaterializer(
            store, Clock.fixed(NOW, ZoneOffset.UTC), new Sequence("intent-2"));

    materializer.materialize("schedule-1", MONDAY, MONDAY);

    verify(store, never()).replaceIntent(any(), any());
  }

  private ScheduleRule schedule() {
    PlaceSnapshot home = place("home", 106.6, 10.7);
    PlaceSnapshot school = place("school", 106.7, 10.8);
    return new ScheduleRule(
        "schedule-1",
        "user-1",
        "Morning class",
        ActivityCategory.STUDY,
        Set.of(DayOfWeek.MONDAY),
        MONDAY,
        null,
        LocalTime.of(8, 0),
        LocalTime.of(10, 0),
        ScheduleRule.V1_ZONE,
        school,
        home,
        15,
        Set.of(ScheduleDirection.OUTBOUND, ScheduleDirection.RETURN),
        TravelRole.RIDER,
        ScheduleVisibility.PRIVATE,
        ScheduleStatus.ACTIVE,
        0,
        NOW,
        NOW);
  }

  private PlaceSnapshot place(String id, double longitude, double latitude) {
    return new PlaceSnapshot("FAKE", id, id, "District", longitude, latitude, NOW);
  }

  private static final class Sequence implements java.util.function.Supplier<String> {
    private final java.util.ArrayDeque<String> values;

    private Sequence(String... values) {
      this.values = new java.util.ArrayDeque<>(List.of(values));
    }

    @Override
    public String get() {
      return values.removeFirst();
    }
  }
}
