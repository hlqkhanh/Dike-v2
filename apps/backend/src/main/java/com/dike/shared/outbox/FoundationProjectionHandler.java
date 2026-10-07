package com.dike.shared.outbox;

import java.time.Clock;
import org.bson.Document;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Component;

@Component
class FoundationProjectionHandler implements OutboxHandler {

  private final MongoTemplate template;
  private final Clock clock;

  FoundationProjectionHandler(MongoTemplate template, Clock clock) {
    this.template = template;
    this.clock = clock;
  }

  @Override
  public String consumerName() {
    return "shared.foundation-projection.v1";
  }

  @Override
  public String eventType() {
    return "foundation.projection";
  }

  @Override
  public int payloadVersion() {
    return 1;
  }

  @Override
  public void handle(OutboxEvent event) {
    try {
      template.insert(
          new Document("eventId", event.eventId()).append("processedAt", clock.instant()),
          "processed_events");
    } catch (DuplicateKeyException ignored) {
      // The unique eventId is the idempotency key; a replay is already complete.
    }
  }
}
