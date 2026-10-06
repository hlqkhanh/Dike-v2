package com.dike.identity.infrastructure.mongo;

import com.dike.shared.infrastructure.migration.MongoMigration;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.CompoundIndexDefinition;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.stereotype.Component;

@Component
class IdentityIndexesMigration implements MongoMigration {

  @Override
  public String id() {
    return "V002__identity_indexes";
  }

  @Override
  public String checksum() {
    return "sha256:cd289a51c891d2bff31d9f62c0249b62fe0a67f856fe5bc7cce51d1bcce48ef8";
  }

  @Override
  public void apply(MongoTemplate template) {
    template
        .indexOps("auth_identities")
        .ensureIndex(
            new CompoundIndexDefinition(new org.bson.Document("issuer", 1).append("subject", 1))
                .unique()
                .named("uq_auth_identity_issuer_subject"));
    template
        .indexOps("auth_identities")
        .ensureIndex(new Index().on("userId", Sort.Direction.ASC).named("ix_auth_identity_user"));
    template
        .indexOps("users")
        .ensureIndex(
            new Index()
                .on("canonicalEmail", Sort.Direction.ASC)
                .unique()
                .named("uq_user_canonical_email"));
  }
}
