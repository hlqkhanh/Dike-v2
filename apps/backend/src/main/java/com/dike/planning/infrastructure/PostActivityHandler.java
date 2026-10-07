package com.dike.planning.infrastructure;

import com.dike.shared.outbox.OutboxEvent;
import com.dike.shared.outbox.OutboxHandler;
import java.util.Set;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.stereotype.Component;

@Component
class PostActivityHandler implements OutboxHandler {
  private final MongoTemplate mongo;

  PostActivityHandler(MongoTemplate mongo) {
    this.mongo = mongo;
  }

  public String eventType() {
    return "post.published";
  }

  public Set<String> eventTypes() {
    return Set.of("post.published", "post.changed", "post.closed", "post.matched");
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
        "post_revisions");
  }
}
