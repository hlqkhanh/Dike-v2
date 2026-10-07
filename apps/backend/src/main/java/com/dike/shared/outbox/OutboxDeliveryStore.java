package com.dike.shared.outbox;

import java.time.Instant;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

@Component
class OutboxDeliveryStore {

  private final MongoTemplate template;

  OutboxDeliveryStore(MongoTemplate template) {
    this.template = template;
  }

  boolean isCompleted(String eventId, String consumerName) {
    Query query =
        Query.query(
            Criteria.where("_id")
                .is(id(eventId, consumerName))
                .and("status")
                .is(OutboxDeliveryStatus.COMPLETED));
    return template.exists(query, OutboxDelivery.class);
  }

  void complete(String eventId, String consumerName, Instant now) {
    template.upsert(
        Query.query(Criteria.where("_id").is(id(eventId, consumerName))),
        new Update()
            .setOnInsert("eventId", eventId)
            .setOnInsert("consumerName", consumerName)
            .inc("attempts", 1)
            .set("status", OutboxDeliveryStatus.COMPLETED)
            .set("updatedAt", now)
            .set("completedAt", now)
            .unset("lastError"),
        OutboxDelivery.class);
  }

  void fail(String eventId, String consumerName, Instant now, String error) {
    template.upsert(
        Query.query(Criteria.where("_id").is(id(eventId, consumerName))),
        new Update()
            .setOnInsert("eventId", eventId)
            .setOnInsert("consumerName", consumerName)
            .inc("attempts", 1)
            .set("status", OutboxDeliveryStatus.FAILED)
            .set("updatedAt", now)
            .set("lastError", error),
        OutboxDelivery.class);
  }

  private String id(String eventId, String consumerName) {
    return eventId + ":" + consumerName;
  }
}
