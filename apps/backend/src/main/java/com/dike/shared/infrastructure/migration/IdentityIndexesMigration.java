package com.dike.shared.infrastructure.migration;

import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.stereotype.Component;

@Component
class IdentityIndexesMigration implements MongoMigration {
  public String id() {
    return "V002__identity_indexes";
  }

  public String checksum() {
    return "identity-provider-subject-unique-v1";
  }

  public void apply(MongoTemplate mongo) {
    if (!mongo.collectionExists("users")) mongo.createCollection("users");
    if (!mongo.collectionExists("auth_identities")) mongo.createCollection("auth_identities");
    mongo
        .indexOps("auth_identities")
        .ensureIndex(
            new Index()
                .on("provider", Sort.Direction.ASC)
                .on("subject", Sort.Direction.ASC)
                .unique());
    mongo.indexOps("auth_identities").ensureIndex(new Index().on("userId", Sort.Direction.ASC));
  }
}
