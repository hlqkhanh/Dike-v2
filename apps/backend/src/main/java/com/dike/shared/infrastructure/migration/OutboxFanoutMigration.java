package com.dike.shared.infrastructure.migration;

import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.stereotype.Component;

@Component
class OutboxFanoutMigration implements MongoMigration {

  @Override
  public String id() {
    return "V012_0__outbox_fanout";
  }

  @Override
  public String checksum() {
    return "outbox-fanout-v1";
  }

  @Override
  public void apply(MongoTemplate template) {
    if (!template.collectionExists("outbox_deliveries")) {
      template.createCollection("outbox_deliveries");
    }
    template
        .indexOps("outbox_deliveries")
        .ensureIndex(
            new Index()
                .on("eventId", Sort.Direction.ASC)
                .on("consumerName", Sort.Direction.ASC)
                .unique()
                .named("event_consumer_unique"));
    template
        .indexOps("outbox_deliveries")
        .ensureIndex(
            new Index()
                .on("status", Sort.Direction.ASC)
                .on("updatedAt", Sort.Direction.ASC)
                .named("delivery_status_updated"));
  }
}
