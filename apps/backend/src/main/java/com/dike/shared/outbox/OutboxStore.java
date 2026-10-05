package com.dike.shared.outbox;

import java.time.Instant;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

@Component
class OutboxStore {

  private final MongoTemplate template;

  OutboxStore(MongoTemplate template) {
    this.template = template;
  }

  OutboxEvent claim(String workerId, Instant now, Instant lockedUntil) {
    Criteria ready =
        new Criteria()
            .orOperator(
                new Criteria()
                    .andOperator(
                        Criteria.where("status").in(OutboxStatus.PENDING, OutboxStatus.RETRY),
                        Criteria.where("nextAttemptAt").lte(now),
                        new Criteria()
                            .orOperator(
                                Criteria.where("lockedUntil").exists(false),
                                Criteria.where("lockedUntil").is(null),
                                Criteria.where("lockedUntil").lte(now))),
                new Criteria()
                    .andOperator(
                        Criteria.where("status").is(OutboxStatus.PROCESSING),
                        Criteria.where("lockedUntil").lte(now)));
    Query query = Query.query(ready).with(Sort.by("createdAt").ascending());
    Update update =
        new Update()
            .set("status", OutboxStatus.PROCESSING)
            .set("lockedBy", workerId)
            .set("lockedUntil", lockedUntil)
            .inc("attempts", 1);
    return template.findAndModify(
        query, update, FindAndModifyOptions.options().returnNew(true), OutboxEvent.class);
  }

  void complete(OutboxEvent event, Instant completedAt) {
    template.updateFirst(
        owned(event),
        new Update()
            .set("status", OutboxStatus.COMPLETED)
            .set("completedAt", completedAt)
            .unset("lockedBy")
            .unset("lockedUntil")
            .unset("lastError"),
        OutboxEvent.class);
  }

  void fail(OutboxEvent event, Instant nextAttemptAt, boolean terminal, String error) {
    template.updateFirst(
        owned(event),
        new Update()
            .set("status", terminal ? OutboxStatus.FAILED : OutboxStatus.RETRY)
            .set("nextAttemptAt", nextAttemptAt)
            .set("lastError", error)
            .unset("lockedBy")
            .unset("lockedUntil"),
        OutboxEvent.class);
  }

  private Query owned(OutboxEvent event) {
    return Query.query(
        Criteria.where("eventId").is(event.eventId()).and("lockedBy").is(event.lockedBy()));
  }
}
