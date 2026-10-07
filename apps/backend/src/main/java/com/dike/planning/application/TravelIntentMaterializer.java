package com.dike.planning.application;

import com.dike.planning.domain.PlaceSnapshot;
import com.dike.planning.domain.ScheduleDirection;
import com.dike.planning.domain.ScheduleException;
import com.dike.planning.domain.ScheduleExceptionType;
import com.dike.planning.domain.ScheduleRule;
import com.dike.planning.domain.TravelIntent;
import com.dike.planning.domain.TravelIntentCommitmentState;
import com.dike.planning.domain.TravelIntentSourceType;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TravelIntentMaterializer {

  private final PlanningStore store;
  private final Clock clock;
  private final Supplier<String> identifiers;

  public TravelIntentMaterializer(PlanningStore store, Clock clock, Supplier<String> identifiers) {
    this.store = store;
    this.clock = clock;
    this.identifiers = identifiers;
  }

  @Transactional
  public void materialize(String scheduleId, LocalDate from, LocalDate to) {
    ScheduleRule schedule = store.schedule(scheduleId).orElseThrow();
    Map<LocalDate, ScheduleException> exceptions =
        store.exceptions(scheduleId, from, to).stream()
            .collect(Collectors.toMap(ScheduleException::localDate, value -> value));
    for (LocalDate date = from; !date.isAfter(to); date = date.plusDays(1)) {
      materializeDate(schedule, exceptions.get(date), date);
    }
  }

  public void materializeHorizon(ScheduleRule schedule) {
    ZoneId zone = ZoneId.of(schedule.zoneId());
    LocalDate today = LocalDate.now(clock.withZone(zone));
    materialize(schedule.id(), today, today.plusDays(13));
  }

  public void materializeHorizon(String scheduleId) {
    materializeHorizon(store.schedule(scheduleId).orElseThrow());
  }

  public void materializeAllActive() {
    store.activeSchedules().forEach(this::materializeHorizon);
  }

  private void materializeDate(
      ScheduleRule schedule, ScheduleException exception, LocalDate localDate) {
    boolean skipped =
        !schedule.appliesOn(localDate)
            || (exception != null && exception.type() == ScheduleExceptionType.SKIP);
    Set<ScheduleDirection> directions =
        skipped
            ? Set.of()
            : exception != null && !exception.directions().isEmpty()
                ? exception.directions()
                : schedule.directions();
    for (ScheduleDirection direction : EnumSet.allOf(ScheduleDirection.class)) {
      TravelIntent existing =
          store.scheduledIntent(schedule.id(), localDate, direction).orElse(null);
      if (!directions.contains(direction)) {
        retire(existing);
        continue;
      }
      TravelIntent desired = desired(schedule, exception, localDate, direction, existing);
      if (existing == null) {
        store.insertIntent(desired);
      } else if (existing.commitmentState() == TravelIntentCommitmentState.PRIVATE
          || existing.commitmentState() == TravelIntentCommitmentState.CANCELLED) {
        if (!sameSnapshot(existing, desired)
            || existing.commitmentState() == TravelIntentCommitmentState.CANCELLED) {
          store.replaceIntent(existing, desired);
        }
      } else if (!sameSnapshot(existing, desired) && !existing.sourceChanged()) {
        store.replaceIntent(existing, markChanged(existing));
      }
    }
  }

  private TravelIntent desired(
      ScheduleRule schedule,
      ScheduleException exception,
      LocalDate date,
      ScheduleDirection direction,
      TravelIntent existing) {
    LocalTime start =
        exception != null && exception.startLocalTime() != null
            ? exception.startLocalTime()
            : schedule.startLocalTime();
    LocalTime end =
        exception != null && exception.endLocalTime() != null
            ? exception.endLocalTime()
            : schedule.endLocalTime();
    PlaceSnapshot activity =
        exception != null && exception.activityPlace() != null
            ? exception.activityPlace()
            : schedule.activityPlace();
    PlaceSnapshot origin =
        exception != null && exception.usualOrigin() != null
            ? exception.usualOrigin()
            : schedule.usualOrigin();
    ZoneId zone = ZoneId.of(schedule.zoneId());
    Instant now = clock.instant();
    Instant arrival =
        direction == ScheduleDirection.OUTBOUND
            ? date.atTime(start)
                .atZone(zone)
                .minusMinutes(schedule.arrivalBufferMinutes())
                .toInstant()
            : null;
    Instant departure =
        direction == ScheduleDirection.RETURN ? date.atTime(end).atZone(zone).toInstant() : null;
    return new TravelIntent(
        existing == null ? identifiers.get() : existing.id(),
        schedule.ownerUserId(),
        TravelIntentSourceType.SCHEDULE,
        schedule.id(),
        schedule.version(),
        date,
        direction,
        schedule.defaultTravelRole(),
        direction == ScheduleDirection.OUTBOUND ? origin : activity,
        direction == ScheduleDirection.OUTBOUND ? activity : origin,
        departure,
        arrival,
        TravelIntentCommitmentState.PRIVATE,
        false,
        existing == null ? 0 : existing.version() + 1,
        existing == null ? null : existing.matchedWithUserId(),
        existing == null ? now : existing.createdAt(),
        now);
  }

  private void retire(TravelIntent existing) {
    if (existing == null || existing.commitmentState() == TravelIntentCommitmentState.CANCELLED) {
      return;
    }
    if (existing.commitmentState() == TravelIntentCommitmentState.PRIVATE) {
      store.replaceIntent(existing, cancelled(existing));
    } else if (!existing.sourceChanged()) {
      store.replaceIntent(existing, markChanged(existing));
    }
  }

  private TravelIntent cancelled(TravelIntent value) {
    return copy(value, TravelIntentCommitmentState.CANCELLED, false);
  }

  private TravelIntent markChanged(TravelIntent value) {
    return copy(value, value.commitmentState(), true);
  }

  private TravelIntent copy(
      TravelIntent value, TravelIntentCommitmentState state, boolean sourceChanged) {
    return new TravelIntent(
        value.id(),
        value.ownerUserId(),
        value.sourceType(),
        value.scheduleId(),
        value.sourceVersion(),
        value.localDate(),
        value.direction(),
        value.travelRole(),
        value.origin(),
        value.destination(),
        value.earliestDepartureAt(),
        value.arrivalDeadlineAt(),
        state,
        sourceChanged,
        value.version() + 1,
        value.matchedWithUserId(),
        value.createdAt(),
        clock.instant());
  }

  private boolean sameSnapshot(TravelIntent left, TravelIntent right) {
    return left.sourceVersion() == right.sourceVersion()
        && left.travelRole() == right.travelRole()
        && left.origin().equals(right.origin())
        && left.destination().equals(right.destination())
        && java.util.Objects.equals(left.earliestDepartureAt(), right.earliestDepartureAt())
        && java.util.Objects.equals(left.arrivalDeadlineAt(), right.arrivalDeadlineAt());
  }
}
