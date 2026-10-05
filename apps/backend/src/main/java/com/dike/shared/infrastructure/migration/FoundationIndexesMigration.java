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
    return "sha256:7fd15489bea82d97ed9999e7337f214f2025a0327bdcfd21ae96c3d9113ea001";
  }

  @Override
  public void apply(MongoTemplate template) {
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
