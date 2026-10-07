package com.dike.planning.infrastructure.mongo;

import com.dike.planning.JourneySources;
import com.dike.planning.domain.*;
import com.dike.shared.api.ApiException;
import com.mongodb.ReadPreference;
import java.time.*;
import java.util.*;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.*;

/** Stage 7/8 adapter. Reads only owner-bound server snapshots, never network providers. */
@Component
public class PlanningJourneySources
    implements JourneySources, com.dike.planning.application.PostSourceBindings {
  private final MongoTemplate mongo;
  private final Clock clock;

  public PlanningJourneySources(MongoTemplate mongo, Clock clock) {
    this.mongo = mongo;
    this.clock = clock;
  }

  public boolean available() {
    return true;
  }

  public String create(String actor, String routeId, Instant departure, Instant arrival) {
    var route =
        mongo.findOne(
            q(Criteria.where("_id").is(routeId).and("ownerUserId").is(actor)),
            RouteSnapshotDocument.class);
    if (route == null
        || !route.expiresAt().isAfter(clock.instant())
        || departure == null
        || arrival == null
        || !departure.isAfter(clock.instant())
        || departure.isAfter(clock.instant().plusSeconds(7 * 86400))
        || arrival.isBefore(departure.plusSeconds(route.durationSeconds()))
        || arrival.isAfter(departure.plusSeconds(86400))) throw changed();
    String id = UUID.randomUUID().toString();
    mongo.insert(
        new TravelIntentDocument(
            id,
            actor,
            TravelIntentSourceType.MANUAL,
            null,
            0,
            departure.atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toLocalDate(),
            ScheduleDirection.OUTBOUND,
            TravelRole.RIDER,
            route.origin(),
            route.destination(),
            departure,
            arrival,
            TravelIntentCommitmentState.PRIVATE,
            false,
            0,
            null,
            clock.instant(),
            clock.instant()));
    bind(actor, id, 0, routeId);
    return id;
  }

  private Query q(Criteria criteria) {
    return Query.query(criteria).withReadPreference(ReadPreference.primary());
  }

  public Optional<Intent> intent(String actor, String id) {
    var source =
        mongo.findOne(
            q(Criteria.where("_id").is(id).and("ownerUserId").is(actor)),
            TravelIntentDocument.class);
    if (source == null
        || source.sourceChanged()
        || source.commitmentState() == TravelIntentCommitmentState.CANCELLED)
      return Optional.empty();
    var binding = mongo.findById(id, Document.class, "post_source_routes");
    if (binding == null || binding.getLong("intentVersion") != source.version())
      return Optional.empty();
    var route =
        mongo.findOne(
            q(Criteria.where("_id").is(binding.getString("routeId")).and("ownerUserId").is(actor)),
            RouteSnapshotDocument.class);
    if (route == null
        || !route.expiresAt().isAfter(clock.instant())
        || !samePlace(source.origin(), route.origin())
        || !samePlace(source.destination(), route.destination())
        || source.arrivalDeadlineAt() == null
        || source.earliestDepartureAt() == null) return Optional.empty();
    Instant latest = source.arrivalDeadlineAt().minusSeconds(route.durationSeconds());
    if (latest.isBefore(source.earliestDepartureAt())) return Optional.empty();
    return Optional.of(
        new Intent(
            source.id(),
            actor,
            source.version(),
            route.origin().publicAreaLabel(),
            route.destination().publicAreaLabel(),
            source.earliestDepartureAt(),
            latest,
            source.arrivalDeadlineAt(),
            route.vehicleMode() == VehicleMode.CAR ? "CAR" : "MOTORCYCLE",
            route.id()));
  }

  private boolean samePlace(PlaceDocument a, PlaceDocument b) {
    return a.provider().equals(b.provider())
        && a.providerPlaceId().equals(b.providerPlaceId())
        && Double.compare(a.latitude(), b.latitude()) == 0
        && Double.compare(a.longitude(), b.longitude()) == 0;
  }

  public Optional<Route> route(String actor, String id) {
    var route =
        mongo.findOne(
            q(Criteria.where("_id").is(id).and("ownerUserId").is(actor)),
            RouteSnapshotDocument.class);
    return route == null
        ? Optional.empty()
        : Optional.of(
            new Route(
                route.id(),
                route.version(),
                route.expiresAt(),
                route.distanceMeters(),
                route.durationSeconds(),
                route.origin().publicAreaLabel(),
                route.destination().publicAreaLabel(),
                route.vehicleMode() == VehicleMode.CAR ? "CAR" : "MOTORCYCLE"));
  }

  @Transactional(propagation = Propagation.MANDATORY)
  public void commitIntent(String actor, String id, long version, String state) {
    if (!Set.of("PRIVATE", "PUBLISHED", "BOOKED").contains(state))
      throw new IllegalArgumentException("Invalid commitment");
    var allowed =
        state.equals("PUBLISHED")
            ? List.of("PRIVATE", "PUBLISHED")
            : state.equals("BOOKED")
                ? List.of("PUBLISHED")
                : List.of("PRIVATE", "PUBLISHED", "BOOKED");
    if (mongo
            .updateFirst(
                q(
                    Criteria.where("_id")
                        .is(id)
                        .and("ownerUserId")
                        .is(actor)
                        .and("version")
                        .is(version)
                        .and("sourceChanged")
                        .is(false)
                        .and("commitmentState")
                        .in(allowed)),
                new Update().set("commitmentState", state).inc("rideFence", 1L),
                "travel_intents")
            .getModifiedCount()
        != 1) throw changed();
  }

  @Transactional(propagation = Propagation.MANDATORY)
  public void releaseIntent(String actor, String id) {
    mongo.updateFirst(
        q(
            Criteria.where("_id")
                .is(id)
                .and("ownerUserId")
                .is(actor)
                .and("commitmentState")
                .is("PUBLISHED")),
        new Update().set("commitmentState", "PRIVATE").inc("rideFence", 1L),
        "travel_intents");
  }

  public void bind(String actor, String id, long version, String routeId) {
    if (mongo.exists(
        q(Criteria.where("sourceId").is(id).and("status").in("DRAFT", "OPEN", "MATCHED")),
        "ride_posts")) throw changed();
    var source =
        mongo.findOne(
            q(
                Criteria.where("_id")
                    .is(id)
                    .and("ownerUserId")
                    .is(actor)
                    .and("version")
                    .is(version)
                    .and("commitmentState")
                    .is("PRIVATE")),
            TravelIntentDocument.class);
    var route =
        mongo.findOne(
            q(Criteria.where("_id").is(routeId).and("ownerUserId").is(actor)),
            RouteSnapshotDocument.class);
    if (source == null
        || route == null
        || source.travelRole() != TravelRole.RIDER
        || !route.expiresAt().isAfter(clock.instant())
        || !samePlace(source.origin(), route.origin())
        || !samePlace(source.destination(), route.destination())
        || source.earliestDepartureAt() == null
        || source.arrivalDeadlineAt() == null
        || source
            .arrivalDeadlineAt()
            .minusSeconds(route.durationSeconds())
            .isBefore(source.earliestDepartureAt())) throw changed();
    mongo.updateFirst(
        q(Criteria.where("_id").is(id).and("version").is(version)),
        new Update().inc("rideFence", 1L),
        "travel_intents");
    mongo.upsert(
        q(Criteria.where("_id").is(id)),
        new Update().set("intentVersion", version).set("routeId", routeId),
        "post_source_routes");
  }

  private ApiException changed() {
    return new ApiException(
        HttpStatus.CONFLICT,
        "SOURCE_ROUTE_CHANGED",
        "Chọn nhu cầu có khoảng giờ đầy đủ và tuyến đường còn hiệu lực, đúng hai điểm đi/đến");
  }
}
