package com.dike.shared.infrastructure.migration;

import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.stereotype.Component;

@Component
class FoundationIndexesMigration implements MongoMigration {

  @Override
  public String id() {
    return "V001__foundation_indexes";
  }

  @Override
  public String checksum() {
    return "sha256:9d13f104c43dbef4a26fa80a0c41b78d80fba477b7c936c2bed5c02de16d1784";
  }

  @Override
  public void apply(MongoTemplate template) {
    template
        .indexOps("outbox_events")
        .ensureIndex(new Index().on("eventId", Sort.Direction.ASC).unique());
    template
        .indexOps("outbox_events")
        .ensureIndex(
            new Index()
                .on("status", Sort.Direction.ASC)
                .on("nextAttemptAt", Sort.Direction.ASC)
                .on("lockedUntil", Sort.Direction.ASC)
                .on("createdAt", Sort.Direction.ASC));
    template
        .indexOps("processed_events")
        .ensureIndex(new Index().on("eventId", Sort.Direction.ASC).unique());
  }
}
