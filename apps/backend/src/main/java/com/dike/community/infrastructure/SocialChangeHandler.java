package com.dike.community.infrastructure;

import com.dike.community.SocialRealtimePublisher;
import com.dike.shared.outbox.OutboxEvent;
import com.dike.shared.outbox.OutboxHandler;
import java.time.Clock;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

/** Durable delivery watermark; client revision is already committed with the relation. */
@Component
class SocialChangeHandler implements OutboxHandler {
  private final MongoTemplate mongo;
  private final SocialRealtimePublisher realtime;
  private final Clock clock;

  SocialChangeHandler(MongoTemplate mongo, SocialRealtimePublisher realtime, Clock clock) {
    this.mongo = mongo;
    this.realtime = realtime;
    this.clock = clock;
  }

  @Override
  public String consumerName() {
    return "community.social-change.v1";
  }

  @Override
  public String eventType() {
    return "social.relationship.changed";
  }

  @Override
  public int payloadVersion() {
    return 1;
  }

  @Override
  public void handle(OutboxEvent event) {
    long version = ((Number) event.payload().get("relationVersion")).longValue();
    mongo.updateFirst(
        Query.query(Criteria.where("_id").is(event.aggregateId())),
        new Update().max("deliveredVersion", version),
        "social_relations");
    String low = String.valueOf(event.payload().get("low"));
    String high = String.valueOf(event.payload().get("high"));
    String action = String.valueOf(event.payload().get("action"));
    publish(event, low, high, action, version);
    publish(event, high, low, action, version);
  }

  private void publish(
      OutboxEvent event, String recipient, String counterpart, String action, long version) {
    try {
      realtime.publish(
          new SocialRealtimePublisher.Change(
              event.eventId(),
              event.aggregateId(),
              recipient,
              counterpart,
              action,
              version,
              clock.instant()));
    } catch (RuntimeException ignored) {
      // REST revision reconciliation remains authoritative when Redis is unavailable.
    }
  }
}
