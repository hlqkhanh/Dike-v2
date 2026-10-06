package com.dike.community.infrastructure;

import com.dike.shared.infrastructure.migration.MongoMigration;
import java.time.Duration;
import org.springframework.data.domain.Sort.Direction;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.stereotype.Component;

@Component
public class SocialIndexesMigration implements MongoMigration {
  @Override
  public String id() {
    return "V006__social_relations";
  }

  @Override
  public String checksum() {
    return "sha256:social-relations-v1";
  }

  @Override
  public void apply(MongoTemplate mongo) {
    for (String collection :
        java.util.List.of(
            "social_relations",
            "social_receipts",
            "social_quotas",
            "social_revisions",
            "social_audit",
            "social_global")) {
      if (!mongo.collectionExists(collection)) mongo.createCollection(collection);
    }
    var indexes = mongo.indexOps("social_relations");
    indexes.ensureIndex(new Index().on("low", Direction.ASC).on("high", Direction.ASC).unique());
    for (String side : java.util.List.of("low", "high"))
      indexes.ensureIndex(
          new Index().on(side, Direction.ASC).on("status", Direction.ASC).on("_id", Direction.ASC));
    indexes.ensureIndex(new Index().on("requestId", Direction.ASC));
    indexes.ensureIndex(new Index().on("requester", Direction.ASC).on("status", Direction.ASC));
    indexes.ensureIndex(new Index().on("blockedBy", Direction.ASC).on("_id", Direction.ASC));
    mongo
        .indexOps("social_receipts")
        .ensureIndex(new Index().on("expiresAt", Direction.ASC).expire(Duration.ZERO));
    mongo
        .indexOps("social_audit")
        .ensureIndex(
            new Index().on("relationId", Direction.ASC).on("version", Direction.ASC).unique());
  }
}
