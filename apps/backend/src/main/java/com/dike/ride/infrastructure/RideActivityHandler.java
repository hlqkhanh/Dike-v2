package com.dike.ride.infrastructure;

import com.dike.shared.outbox.OutboxEvent;
import com.dike.shared.outbox.OutboxHandler;
import java.util.Set;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.stereotype.Component;

/** Durable revision projection. It never grants access; readers recheck live permissions. */
@Component
class RideActivityHandler implements OutboxHandler {
  private final MongoTemplate mongo;

  RideActivityHandler(MongoTemplate mongo) {
    this.mongo = mongo;
  }

  public String eventType() {
    return "booking.confirmed";
  }

  public Set<String> eventTypes() {
    return Set.of(
        "booking.confirmed",
        "booking.changed",
        "trip.opened",
        "trip.changed",
        "proposal.created",
        "proposal.closed");
  }

  public int payloadVersion() {
    return 1;
  }

  public void handle(OutboxEvent event) {
    mongo.upsert(
        Query.query(Criteria.where("_id").is(event.aggregateId())),
        new Update()
            .max("version", ((Number) event.payload().get("version")).longValue())
            .max("changedAt", event.createdAt()),
        "ride_revisions");
  }
}
