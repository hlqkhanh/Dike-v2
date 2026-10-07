package com.dike.community.infrastructure;

import com.dike.shared.outbox.OutboxEvent;
import com.dike.shared.outbox.OutboxHandler;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

/** Durable delivery watermark; client revision is already committed with the relation. */
@Component
class SocialChangeHandler implements OutboxHandler {
  private final MongoTemplate mongo;

  SocialChangeHandler(MongoTemplate mongo) {
    this.mongo = mongo;
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
  }
}
