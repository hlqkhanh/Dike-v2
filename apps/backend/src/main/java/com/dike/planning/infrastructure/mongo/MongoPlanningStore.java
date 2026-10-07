package com.dike.planning.infrastructure.mongo;

import com.dike.planning.application.PlanningStore;
import com.dike.planning.domain.PlaceSnapshot;
import com.dike.planning.domain.RouteSnapshot;
import com.dike.planning.domain.ScheduleDirection;
import com.dike.planning.domain.ScheduleException;
import com.dike.planning.domain.ScheduleRule;
import com.dike.planning.domain.TravelIntent;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

@Repository
public class MongoPlanningStore implements PlanningStore {

  private final MongoTemplate mongo;

  public MongoPlanningStore(MongoTemplate mongo) {
    this.mongo = mongo;
  }

  @Override
  public ScheduleRule insertSchedule(ScheduleRule schedule) {
    return map(mongo.insert(map(schedule)));
  }

  @Override
  public Optional<ScheduleRule> schedule(String scheduleId) {
    return Optional.ofNullable(mongo.findById(scheduleId, ScheduleRuleDocument.class))
        .map(this::map);
  }

  @Override
  public List<ScheduleRule> schedules(String ownerUserId) {
    return mongo
        .find(
            Query.query(Criteria.where("ownerUserId").is(ownerUserId))
                .with(Sort.by(Sort.Direction.ASC, "name", "_id")),
            ScheduleRuleDocument.class)
        .stream()
        .map(this::map)
        .toList();
  }

  @Override
  public List<ScheduleRule> schedules(List<String> ownerUserIds) {
    if (ownerUserIds == null || ownerUserIds.isEmpty()) return List.of();
    return mongo
        .find(
            Query.query(Criteria.where("ownerUserId").in(ownerUserIds))
                .with(Sort.by(Sort.Direction.ASC, "name", "_id")),
            ScheduleRuleDocument.class)
        .stream()
        .map(this::map)
        .toList();
  }

  @Override
  public List<ScheduleRule> activeSchedules() {
    return mongo
        .find(
            Query.query(Criteria.where("status").is("ACTIVE"))
                .with(Sort.by(Sort.Direction.ASC, "_id")),
            ScheduleRuleDocument.class)
        .stream()
        .map(this::map)
        .toList();
  }

  @Override
  public ScheduleRule replaceSchedule(ScheduleRule before, ScheduleRule after) {
    replace(
        Query.query(Criteria.where("_id").is(before.id()).and("version").is(before.version())),
        map(after),
        "schedule_rules",
        "Schedule changed");
    return after;
  }

  @Override
  public ScheduleException insertException(ScheduleException exception) {
    return map(mongo.insert(map(exception)));
  }

  @Override
  public Optional<ScheduleException> exception(String scheduleId, LocalDate localDate) {
    return Optional.ofNullable(
            mongo.findOne(
                Query.query(
                    Criteria.where("scheduleId").is(scheduleId).and("localDate").is(localDate)),
                ScheduleExceptionDocument.class))
        .map(this::map);
  }

  @Override
  public List<ScheduleException> exceptions(String scheduleId, LocalDate from, LocalDate to) {
    return mongo
        .find(
            Query.query(
                    Criteria.where("scheduleId").is(scheduleId).and("localDate").gte(from).lte(to))
                .with(Sort.by(Sort.Direction.ASC, "localDate")),
            ScheduleExceptionDocument.class)
        .stream()
        .map(this::map)
        .toList();
  }

  @Override
  public ScheduleException replaceException(ScheduleException before, ScheduleException after) {
    replace(
        Query.query(Criteria.where("_id").is(before.id()).and("version").is(before.version())),
        map(after),
        "schedule_exceptions",
        "Schedule exception changed");
    return after;
  }

  @Override
  public void deleteException(ScheduleException exception) {
    var result =
        mongo.remove(
            Query.query(
                Criteria.where("_id").is(exception.id()).and("version").is(exception.version())),
            ScheduleExceptionDocument.class);
    if (result.getDeletedCount() != 1) throw stale("Schedule exception changed");
  }

  @Override
  public TravelIntent insertIntent(TravelIntent intent) {
    return map(mongo.insert(map(intent)));
  }

  @Override
  public Optional<TravelIntent> intent(String intentId) {
    return Optional.ofNullable(mongo.findById(intentId, TravelIntentDocument.class)).map(this::map);
  }

  @Override
  public Optional<TravelIntent> scheduledIntent(
      String scheduleId, LocalDate localDate, ScheduleDirection direction) {
    return Optional.ofNullable(
            mongo.findOne(
                Query.query(
                    Criteria.where("sourceType")
                        .is("SCHEDULE")
                        .and("scheduleId")
                        .is(scheduleId)
                        .and("localDate")
                        .is(localDate)
                        .and("direction")
                        .is(direction)),
                TravelIntentDocument.class))
        .map(this::map);
  }

  @Override
  public List<TravelIntent> intents(String ownerUserId, LocalDate from, LocalDate to) {
    return mongo
        .find(
            Query.query(
                    Criteria.where("ownerUserId")
                        .is(ownerUserId)
                        .and("localDate")
                        .gte(from)
                        .lte(to))
                .with(Sort.by(Sort.Direction.ASC, "localDate", "direction", "_id")),
            TravelIntentDocument.class)
        .stream()
        .map(this::map)
        .toList();
  }

  @Override
  public List<TravelIntent> activeIntents() {
    return mongo
        .find(
            Query.query(Criteria.where("commitmentState").is("PUBLISHED")),
            TravelIntentDocument.class)
        .stream()
        .map(this::map)
        .toList();
  }

  @Override
  public TravelIntent replaceIntent(TravelIntent before, TravelIntent after) {
    replace(
        Query.query(
            Criteria.where("_id")
                .is(before.id())
                .and("version")
                .is(before.version())
                .and("commitmentState")
                .is(before.commitmentState())),
        map(after),
        "travel_intents",
        "Travel intent changed");
    return after;
  }

  @Override
  public RouteSnapshot insertRoute(RouteSnapshot route) {
    return map(mongo.insert(map(route)));
  }

  @Override
  public Optional<RouteSnapshot> route(String routeId) {
    return Optional.ofNullable(mongo.findById(routeId, RouteSnapshotDocument.class)).map(this::map);
  }

  private void replace(Query query, Object document, String collection, String message) {
    var result = mongo.replace(query, document, collection);
    if (result.getModifiedCount() != 1) throw stale(message);
  }

  private OptimisticLockingFailureException stale(String message) {
    return new OptimisticLockingFailureException(message);
  }

  private ScheduleRuleDocument map(ScheduleRule value) {
    return new ScheduleRuleDocument(
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
        map(value.activityPlace()),
        map(value.usualOrigin()),
        value.arrivalBufferMinutes(),
        value.directions(),
        value.defaultTravelRole(),
        value.visibility(),
        value.status(),
        value.version(),
        value.createdAt(),
        value.updatedAt());
  }

  private ScheduleRule map(ScheduleRuleDocument value) {
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
        map(value.activityPlace()),
        map(value.usualOrigin()),
        value.arrivalBufferMinutes(),
        value.directions(),
        value.defaultTravelRole(),
        value.visibility(),
        value.status(),
        value.version(),
        value.createdAt(),
        value.updatedAt());
  }

  private ScheduleExceptionDocument map(ScheduleException value) {
    return new ScheduleExceptionDocument(
        value.id(),
        value.scheduleId(),
        value.ownerUserId(),
        value.localDate(),
        value.type(),
        value.startLocalTime(),
        value.endLocalTime(),
        map(value.activityPlace()),
        map(value.usualOrigin()),
        value.directions(),
        value.version(),
        value.createdAt(),
        value.updatedAt());
  }

  private ScheduleException map(ScheduleExceptionDocument value) {
    return new ScheduleException(
        value.id(),
        value.scheduleId(),
        value.ownerUserId(),
        value.localDate(),
        value.type(),
        value.startLocalTime(),
        value.endLocalTime(),
        map(value.activityPlace()),
        map(value.usualOrigin()),
        value.directions(),
        value.version(),
        value.createdAt(),
        value.updatedAt());
  }

  private TravelIntentDocument map(TravelIntent value) {
    return new TravelIntentDocument(
        value.id(),
        value.ownerUserId(),
        value.sourceType(),
        value.scheduleId(),
        value.sourceVersion(),
        value.localDate(),
        value.direction(),
        value.travelRole(),
        map(value.origin()),
        map(value.destination()),
        value.earliestDepartureAt(),
        value.arrivalDeadlineAt(),
        value.commitmentState(),
        value.sourceChanged(),
        value.version(),
        value.matchedWithUserId(),
        value.createdAt(),
        value.updatedAt());
  }

  private TravelIntent map(TravelIntentDocument value) {
    return new TravelIntent(
        value.id(),
        value.ownerUserId(),
        value.sourceType(),
        value.scheduleId(),
        value.sourceVersion(),
        value.localDate(),
        value.direction(),
        value.travelRole(),
        map(value.origin()),
        map(value.destination()),
        value.earliestDepartureAt(),
        value.arrivalDeadlineAt(),
        value.commitmentState(),
        value.sourceChanged(),
        value.version(),
        value.matchedWithUserId(),
        value.createdAt(),
        value.updatedAt());
  }

  private PlaceDocument map(PlaceSnapshot value) {
    if (value == null) return null;
    return new PlaceDocument(
        value.provider(),
        value.providerPlaceId(),
        value.displayLabel(),
        value.publicAreaLabel(),
        value.longitude(),
        value.latitude(),
        value.resolvedAt());
  }

  private RouteSnapshotDocument map(RouteSnapshot value) {
    return new RouteSnapshotDocument(
        value.id(),
        value.ownerUserId(),
        value.provider(),
        value.providerRouteId(),
        value.vehicleMode(),
        map(value.origin()),
        map(value.destination()),
        value.distanceMeters(),
        value.durationSeconds(),
        value.geometry(),
        value.calculatedAt(),
        value.expiresAt(),
        value.version());
  }

  private RouteSnapshot map(RouteSnapshotDocument value) {
    return new RouteSnapshot(
        value.id(),
        value.ownerUserId(),
        value.provider(),
        value.providerRouteId(),
        value.vehicleMode(),
        map(value.origin()),
        map(value.destination()),
        value.distanceMeters(),
        value.durationSeconds(),
        value.geometry(),
        value.calculatedAt(),
        value.expiresAt(),
        value.version());
  }

  private PlaceSnapshot map(PlaceDocument value) {
    if (value == null) return null;
    return new PlaceSnapshot(
        value.provider(),
        value.providerPlaceId(),
        value.displayLabel(),
        value.publicAreaLabel(),
        value.longitude(),
        value.latitude(),
        value.resolvedAt());
  }
}
