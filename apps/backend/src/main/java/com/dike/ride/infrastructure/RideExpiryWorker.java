package com.dike.ride.infrastructure;

import com.dike.planning.PostAccess;
import com.dike.ride.application.RideStore;
import com.dike.ride.domain.*;
import com.dike.shared.application.AtomicCommands;
import com.dike.shared.outbox.OutboxPublisher;
import java.time.Clock;
import java.util.Map;
import org.springframework.context.annotation.Profile;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@Profile("worker | combined")
class RideExpiryWorker {
  private final MongoTemplate mongo;
  private final RideStore store;
  private final AtomicCommands commands;
  private final PostAccess posts;
  private final OutboxPublisher events;
  private final Clock clock;

  RideExpiryWorker(
      MongoTemplate mongo,
      RideStore store,
      AtomicCommands commands,
      PostAccess posts,
      OutboxPublisher events,
      Clock clock) {
    this.mongo = mongo;
    this.store = store;
    this.commands = commands;
    this.posts = posts;
    this.events = events;
    this.clock = clock;
  }

  @Scheduled(fixedDelayString = "${dike.rides.expiry-interval:30s}")
  void expire() {
    for (var row :
        mongo.find(
            Query.query(
                    Criteria.where("status").is("PENDING").and("expiresAt").lte(clock.instant()))
                .limit(100),
            Proposal.class,
            "ride_proposals"))
      commands.transaction(
          () -> {
            var p = store.proposal(row.id()).orElseThrow();
            if (p.status() == Proposal.Status.PENDING && !p.live(clock.instant())) {
              var next = p.transition(Proposal.Status.EXPIRED, "TIME");
              store.saveProposal(p, next);
              events.publish(
                  "proposal.closed",
                  "Ride",
                  p.id(),
                  1,
                  Map.of("resourceId", p.id(), "version", next.version()));
            }
            return null;
          });
    for (var row :
        mongo.find(
            Query.query(
                    Criteria.where("status")
                        .in("DRAFT", "OPEN", "FULL")
                        .and("departureAt")
                        .lte(clock.instant()))
                .limit(100),
            Trip.class,
            "trips"))
      commands.transaction(
          () -> {
            var t = store.trip(row.id()).orElseThrow();
            if ((t.status() == Trip.Status.DRAFT
                    || t.status() == Trip.Status.OPEN
                    || t.status() == Trip.Status.FULL)
                && !clock.instant().isBefore(t.departureAt())
                && store.tripBookings(t.id()).stream().noneMatch(Booking::active)) {
              commands.fence("availability", t.driverId());
              store.releaseInterval("trip:" + t.id());
              var next = t.status(Trip.Status.EXPIRED);
              store.saveTrip(t, next);
              posts.invalidateTrip(t.id());
              events.publish(
                  "trip.changed",
                  "Ride",
                  t.id(),
                  1,
                  Map.of("resourceId", t.id(), "version", next.version()));
            }
            return null;
          });
  }
}
