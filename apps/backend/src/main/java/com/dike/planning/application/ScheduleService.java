package com.dike.planning.application;

import com.dike.identity.IdentityAccess;
import com.dike.planning.domain.ActivityCategory;
import com.dike.planning.domain.PlaceSnapshot;
import com.dike.planning.domain.ScheduleDirection;
import com.dike.planning.domain.ScheduleException;
import com.dike.planning.domain.ScheduleExceptionType;
import com.dike.planning.domain.ScheduleRule;
import com.dike.planning.domain.ScheduleStatus;
import com.dike.planning.domain.ScheduleVisibility;
import com.dike.planning.domain.TravelRole;
import com.dike.shared.outbox.OutboxPublisher;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Supplier;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ScheduleService {

  private final PlanningStore store;
  private final ResolvedPlaceStore places;
  private final IdentityAccess accounts;
  private final com.dike.community.SocialAccessPolicy social;
  private final OutboxPublisher events;
  private final Clock clock;
  private final Supplier<String> identifiers;

  public ScheduleService(
      PlanningStore store,
      ResolvedPlaceStore places,
      IdentityAccess accounts,
      com.dike.community.SocialAccessPolicy social,
      OutboxPublisher events,
      Clock clock,
      Supplier<String> identifiers) {
    this.store = store;
    this.places = places;
    this.accounts = accounts;
    this.social = social;
    this.events = events;
    this.clock = clock;
    this.identifiers = identifiers;
  }

  public record RuleCommand(
      String name,
      ActivityCategory activityCategory,
      Set<DayOfWeek> weekdays,
      LocalDate effectiveFrom,
      LocalDate effectiveUntil,
      LocalTime startLocalTime,
      LocalTime endLocalTime,
      String zoneId,
      String activityPlaceRef,
      String usualOriginRef,
      int arrivalBufferMinutes,
      Set<ScheduleDirection> directions,
      TravelRole defaultTravelRole,
      ScheduleVisibility visibility) {}

  public record ExceptionCommand(
      ScheduleExceptionType type,
      LocalTime startLocalTime,
      LocalTime endLocalTime,
      String activityPlaceRef,
      String usualOriginRef,
      Set<ScheduleDirection> directions,
      long version) {}

  public record Conflict(LocalDate localDate, String scheduleId, String conflictingScheduleId) {}

  public java.util.List<ScheduleRule> listFriendsSchedules(String viewerUserId) {
    accounts.require(viewerUserId);
    java.util.List<String> friends = social.friendsOf(viewerUserId);
    if (friends.isEmpty()) return java.util.List.of();

    return store.schedules(friends).stream()
        .filter(schedule -> schedule.visibility() == ScheduleVisibility.FRIENDS)
        .toList();
  }

  public record MatchResult(
      java.util.List<ScheduleRule> schedules,
      java.util.List<com.dike.planning.domain.TravelIntent> intents) {}

  public MatchResult match(
      String ownerUserId,
      String scheduleId,
      double radiusKm,
      int timeWindowMinutes,
      TravelRole targetRole) {
    ScheduleRule mySchedule = get(ownerUserId, scheduleId);

    var matchingSchedules = store.activeSchedules().stream()
        .filter(s -> !s.ownerUserId().equals(ownerUserId))
        .filter(s -> s.defaultTravelRole() == targetRole)
        .filter(s -> hasOverlappingDays(mySchedule.weekdays(), s.weekdays()))
        .filter(s -> isWithinTimeWindow(mySchedule, s, timeWindowMinutes))
        .filter(s -> isWithinRadius(mySchedule.activityPlace(), s.activityPlace(), radiusKm))
        .filter(s -> isWithinRadius(mySchedule.usualOrigin(), s.usualOrigin(), radiusKm))
        .filter(
            s ->
                social.canRead(
                    ownerUserId,
                    s.ownerUserId(),
                    com.dike.community.SocialAccessPolicy.Visibility.valueOf(s.visibility().name()),
                    true))
        .toList();

    var matchingIntents = store.activeIntents().stream()
        .filter(i -> !i.ownerUserId().equals(ownerUserId))
        .filter(i -> i.travelRole() == targetRole)
        .filter(i -> mySchedule.weekdays().contains(i.localDate().getDayOfWeek()))
        .filter(i -> !i.localDate().isBefore(mySchedule.effectiveFrom()) && !i.localDate().isAfter(mySchedule.effectiveUntil()))
        .filter(i -> isWithinTimeWindow(mySchedule, i, timeWindowMinutes))
        .filter(i -> isWithinRadius(mySchedule.activityPlace(), i.destination(), radiusKm))
        .filter(i -> isWithinRadius(mySchedule.usualOrigin(), i.origin(), radiusKm))
        .filter(i -> social.canRead(ownerUserId, i.ownerUserId(), com.dike.community.SocialAccessPolicy.Visibility.COMMUNITY, true))
        .toList();

    return new MatchResult(matchingSchedules, matchingIntents);
  }

  private boolean hasOverlappingDays(Set<DayOfWeek> a, Set<DayOfWeek> b) {
    return a.stream().anyMatch(b::contains);
  }

  private boolean isWithinTimeWindow(ScheduleRule a, ScheduleRule b, int timeWindowMinutes) {
    long startDiff =
        Math.abs(java.time.Duration.between(a.startLocalTime(), b.startLocalTime()).toMinutes());
    long endDiff =
        Math.abs(java.time.Duration.between(a.endLocalTime(), b.endLocalTime()).toMinutes());
    return startDiff <= timeWindowMinutes && endDiff <= timeWindowMinutes;
  }

  private boolean isWithinTimeWindow(ScheduleRule s, com.dike.planning.domain.TravelIntent i, int timeWindowMinutes) {
    if (i.earliestDepartureAt() == null || i.arrivalDeadlineAt() == null) return false;
    java.time.LocalTime departure = java.time.LocalDateTime.ofInstant(i.earliestDepartureAt(), java.time.ZoneId.of("UTC")).toLocalTime();
    java.time.LocalTime arrival = java.time.LocalDateTime.ofInstant(i.arrivalDeadlineAt(), java.time.ZoneId.of("UTC")).toLocalTime();
    long startDiff = Math.abs(java.time.Duration.between(s.startLocalTime(), departure).toMinutes());
    long endDiff = Math.abs(java.time.Duration.between(s.endLocalTime(), arrival).toMinutes());
    return startDiff <= timeWindowMinutes && endDiff <= timeWindowMinutes;
  }

  private boolean isWithinRadius(PlaceSnapshot a, PlaceSnapshot b, double radiusKm) {
    if (a == null || b == null) return false;
    double lat1 = Math.toRadians(a.latitude());
    double lon1 = Math.toRadians(a.longitude());
    double lat2 = Math.toRadians(b.latitude());
    double lon2 = Math.toRadians(b.longitude());
    double dlon = lon2 - lon1;
    double dlat = lat2 - lat1;
    double aVal =
        Math.pow(Math.sin(dlat / 2), 2)
            + Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin(dlon / 2), 2);
    double c = 2 * Math.asin(Math.sqrt(aVal));
    return c * 6371.0 <= radiusKm;
  }

  @Transactional
  public ScheduleRule create(String ownerUserId, RuleCommand command) {
    IdentityAccess.Access access = requireVerified(ownerUserId);
    requireDriver(access, command.defaultTravelRole());
    Instant now = clock.instant();
    ScheduleRule schedule =
        new ScheduleRule(
            identifiers.get(),
            ownerUserId,
            command.name(),
            command.activityCategory(),
            command.weekdays(),
            command.effectiveFrom(),
            command.effectiveUntil(),
            command.startLocalTime(),
            command.endLocalTime(),
            command.zoneId(),
            place(ownerUserId, command.activityPlaceRef()),
            place(ownerUserId, command.usualOriginRef()),
            command.arrivalBufferMinutes(),
            command.directions(),
            command.defaultTravelRole(),
            command.visibility(),
            ScheduleStatus.ACTIVE,
            0,
            now,
            now);
    ScheduleRule saved = store.insertSchedule(schedule);
    changed(saved, "CREATED");
    return saved;
  }

  public List<ScheduleRule> list(String ownerUserId) {
    requireVerified(ownerUserId);
    return store.schedules(ownerUserId);
  }

  public ScheduleRule get(String ownerUserId, String scheduleId) {
    requireVerified(ownerUserId);
    return owned(ownerUserId, scheduleId);
  }

  @Transactional
  public ScheduleRule replace(
      String ownerUserId, String scheduleId, long expectedVersion, RuleCommand command) {
    IdentityAccess.Access access = requireVerified(ownerUserId);
    requireDriver(access, command.defaultTravelRole());
    ScheduleRule before = owned(ownerUserId, scheduleId);
    requireVersion(before.version(), expectedVersion);
    ScheduleRule after =
        new ScheduleRule(
            before.id(),
            before.ownerUserId(),
            command.name(),
            command.activityCategory(),
            command.weekdays(),
            command.effectiveFrom(),
            command.effectiveUntil(),
            command.startLocalTime(),
            command.endLocalTime(),
            command.zoneId(),
            place(ownerUserId, command.activityPlaceRef()),
            place(ownerUserId, command.usualOriginRef()),
            command.arrivalBufferMinutes(),
            command.directions(),
            command.defaultTravelRole(),
            command.visibility(),
            before.status(),
            before.version() + 1,
            before.createdAt(),
            clock.instant());
    ScheduleRule saved = store.replaceSchedule(before, after);
    changed(saved, "REPLACED");
    return saved;
  }

  @Transactional
  public ScheduleRule status(
      String ownerUserId, String scheduleId, long expectedVersion, ScheduleStatus status) {
    requireVerified(ownerUserId);
    ScheduleRule before = owned(ownerUserId, scheduleId);
    requireVersion(before.version(), expectedVersion);
    if (before.status() == status) return before;
    if (before.status() == ScheduleStatus.ENDED && status != ScheduleStatus.ENDED) {
      throw new InvalidScheduleException();
    }
    ScheduleRule after = copyWithStatus(before, status);
    ScheduleRule saved = store.replaceSchedule(before, after);
    changed(saved, status.name());
    return saved;
  }

  @Transactional
  public ScheduleException upsertException(
      String ownerUserId, String scheduleId, LocalDate date, ExceptionCommand command) {
    requireVerified(ownerUserId);
    ScheduleRule schedule = owned(ownerUserId, scheduleId);
    if (date.isBefore(schedule.effectiveFrom())
        || (schedule.effectiveUntil() != null && date.isAfter(schedule.effectiveUntil()))
        || !schedule.weekdays().contains(date.getDayOfWeek())) {
      throw new InvalidScheduleException();
    }
    Instant now = clock.instant();
    ScheduleException before = store.exception(scheduleId, date).orElse(null);
    if (before != null) requireVersion(before.version(), command.version());
    ScheduleException after =
        new ScheduleException(
            before == null ? identifiers.get() : before.id(),
            scheduleId,
            ownerUserId,
            date,
            command.type(),
            command.startLocalTime(),
            command.endLocalTime(),
            optionalPlace(ownerUserId, command.activityPlaceRef()),
            optionalPlace(ownerUserId, command.usualOriginRef()),
            command.directions(),
            before == null ? 0 : before.version() + 1,
            before == null ? now : before.createdAt(),
            now);
    ScheduleException saved =
        before == null ? store.insertException(after) : store.replaceException(before, after);
    changed(schedule, "EXCEPTION_UPSERTED");
    return saved;
  }

  @Transactional
  public void deleteException(
      String ownerUserId, String scheduleId, LocalDate date, long expectedVersion) {
    requireVerified(ownerUserId);
    ScheduleRule schedule = owned(ownerUserId, scheduleId);
    ScheduleException value =
        store.exception(scheduleId, date).orElseThrow(ScheduleNotFoundException::new);
    requireVersion(value.version(), expectedVersion);
    store.deleteException(value);
    changed(schedule, "EXCEPTION_DELETED");
  }

  public List<Conflict> conflicts(
      String ownerUserId, String scheduleId, LocalDate from, LocalDate to) {
    requireVerified(ownerUserId);
    owned(ownerUserId, scheduleId);
    requireRange(from, to);
    List<ScheduleRule> rules = store.schedules(ownerUserId);
    Map<String, Map<LocalDate, ScheduleException>> exceptions = new HashMap<>();
    for (ScheduleRule rule : rules) {
      exceptions.put(
          rule.id(),
          store.exceptions(rule.id(), from, to).stream()
              .collect(
                  java.util.stream.Collectors.toMap(ScheduleException::localDate, value -> value)));
    }
    List<Conflict> result = new ArrayList<>();
    ScheduleRule target = owned(ownerUserId, scheduleId);
    for (LocalDate date = from; !date.isAfter(to); date = date.plusDays(1)) {
      Interval targetInterval = interval(target, exceptions.get(target.id()).get(date), date);
      if (targetInterval == null) continue;
      for (ScheduleRule other : rules) {
        if (other.id().equals(scheduleId)) continue;
        Interval otherInterval = interval(other, exceptions.get(other.id()).get(date), date);
        if (otherInterval != null && targetInterval.overlaps(otherInterval)) {
          result.add(new Conflict(date, scheduleId, other.id()));
        }
      }
    }
    return List.copyOf(result);
  }

  private IdentityAccess.Access requireVerified(String userId) {
    IdentityAccess.Access access = accounts.require(userId);
    if (!access.verifiedMember()) throw new ScheduleAccessDeniedException();
    return access;
  }

  private void requireDriver(IdentityAccess.Access access, TravelRole role) {
    if (role == TravelRole.DRIVER && !access.approvedDriver()) {
      throw new ScheduleDriverRequiredException();
    }
  }

  private ScheduleRule owned(String ownerUserId, String scheduleId) {
    return store
        .schedule(scheduleId)
        .filter(value -> value.ownerUserId().equals(ownerUserId))
        .orElseThrow(ScheduleNotFoundException::new);
  }

  private PlaceSnapshot place(String ownerUserId, String reference) {
    if (reference == null || !reference.matches("[A-Za-z0-9_-]{8,100}")) {
      throw new InvalidScheduleException();
    }
    return places.find(ownerUserId, reference).orElseThrow(PlaceReferenceExpiredException::new);
  }

  private PlaceSnapshot optionalPlace(String ownerUserId, String reference) {
    return reference == null ? null : place(ownerUserId, reference);
  }

  private void changed(ScheduleRule schedule, String change) {
    events.publish(
        "planning.schedule.changed",
        "ScheduleRule",
        schedule.id(),
        1,
        Map.of(
            "scheduleId", schedule.id(),
            "ownerUserId", schedule.ownerUserId(),
            "change", change));
  }

  private ScheduleRule copyWithStatus(ScheduleRule value, ScheduleStatus status) {
    LocalDate effectiveUntil = value.effectiveUntil();
    if (status == ScheduleStatus.ENDED) {
      LocalDate today = LocalDate.now(clock.withZone(java.time.ZoneId.of(value.zoneId())));
      if (today.isBefore(value.effectiveFrom())) today = value.effectiveFrom();
      effectiveUntil =
          effectiveUntil == null || effectiveUntil.isAfter(today) ? today : effectiveUntil;
    }
    return new ScheduleRule(
        value.id(),
        value.ownerUserId(),
        value.name(),
        value.activityCategory(),
        value.weekdays(),
        value.effectiveFrom(),
        effectiveUntil,
        value.startLocalTime(),
        value.endLocalTime(),
        value.zoneId(),
        value.activityPlace(),
        value.usualOrigin(),
        value.arrivalBufferMinutes(),
        value.directions(),
        value.defaultTravelRole(),
        value.visibility(),
        status,
        value.version() + 1,
        value.createdAt(),
        clock.instant());
  }

  private Interval interval(
      ScheduleRule schedule, ScheduleException exception, LocalDate localDate) {
    if (!schedule.appliesOn(localDate)
        || (exception != null && exception.type() == ScheduleExceptionType.SKIP)) return null;
    LocalTime start =
        exception != null && exception.startLocalTime() != null
            ? exception.startLocalTime()
            : schedule.startLocalTime();
    LocalTime end =
        exception != null && exception.endLocalTime() != null
            ? exception.endLocalTime()
            : schedule.endLocalTime();
    return new Interval(start, end);
  }

  private void requireVersion(long actual, long expected) {
    if (actual != expected) throw new OptimisticLockingFailureException("Schedule changed");
  }

  private void requireRange(LocalDate from, LocalDate to) {
    if (from == null || to == null || to.isBefore(from) || ChronoUnit.DAYS.between(from, to) > 30) {
      throw new InvalidScheduleException();
    }
  }

  private record Interval(LocalTime start, LocalTime end) {
    boolean overlaps(Interval other) {
      return start.isBefore(other.end) && other.start.isBefore(end);
    }
  }

  public static final class ScheduleNotFoundException extends RuntimeException {}

  public static final class ScheduleAccessDeniedException extends RuntimeException {}

  public static final class ScheduleDriverRequiredException extends RuntimeException {}

  public static final class PlaceReferenceExpiredException extends RuntimeException {}

  public static final class InvalidScheduleException extends RuntimeException {}
}
