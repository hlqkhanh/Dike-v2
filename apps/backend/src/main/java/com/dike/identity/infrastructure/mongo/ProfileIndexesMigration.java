package com.dike.identity.infrastructure.mongo;

import com.dike.identity.domain.AccountDeletionState;
import com.dike.shared.infrastructure.migration.MongoMigration;
import java.time.Instant;
import org.bson.Document;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.CompoundIndexDefinition;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.PartialIndexFilter;
import org.springframework.stereotype.Component;

@Component
class ProfileIndexesMigration implements MongoMigration {

  @Override
  public String id() {
    return "V004__profile_privacy_file_indexes";
  }

  @Override
  public String checksum() {
    return "sha256:profile-privacy-file-indexes-v1";
  }

  @Override
  public void apply(MongoTemplate template) {
    template
        .indexOps("user_profiles")
        .ensureIndex(
            new Index()
                .on("normalizedDisplayName", Sort.Direction.ASC)
                .named("ix_profile_normalized_name"));
    template
        .indexOps("consent_receipts")
        .ensureIndex(
            new CompoundIndexDefinition(
                    new Document("userId", 1)
                        .append("consentType", 1)
                        .append("documentVersion", 1)
                        .append("decision", 1))
                .unique()
                .named("uq_consent_decision"));
    template
        .indexOps("consent_receipts")
        .ensureIndex(
            new CompoundIndexDefinition(new Document("userId", 1).append("occurredAt", -1))
                .named("ix_consent_user_time"));
    template
        .indexOps("file_assets")
        .ensureIndex(
            new CompoundIndexDefinition(
                    new Document("ownerUserId", 1).append("purpose", 1).append("state", 1))
                .named("ix_file_owner_purpose_state"));
    template
        .indexOps("file_assets")
        .ensureIndex(
            new CompoundIndexDefinition(new Document("state", 1).append("uploadExpiresAt", 1))
                .named("ix_file_state_expiry"));
    template
        .indexOps("account_deletion_requests")
        .ensureIndex(
            new CompoundIndexDefinition(new Document("userId", 1))
                .partial(
                    PartialIndexFilter.of(
                        new Document(
                            "state",
                            new Document(
                                "$in",
                                java.util.List.of(
                                    AccountDeletionState.REQUESTED.name(),
                                    AccountDeletionState.PROCESSING.name())))))
                .unique()
                .named("uq_active_deletion_user"));
    template
        .indexOps("account_deletion_requests")
        .ensureIndex(
            new CompoundIndexDefinition(new Document("state", 1).append("executeAfter", 1))
                .named("ix_deletion_state_execute"));

    for (Document user : template.findAll(Document.class, "users")) {
      String userId = user.getString("_id");
      if (userId == null) continue;
      String displayName = user.getString("displayName");
      if (displayName == null || displayName.isBlank()) displayName = "Dike member";
      Instant createdAt = instant(user.get("createdAt"));
      Instant updatedAt = instant(user.get("updatedAt"));
      template.upsert(
          org.springframework.data.mongodb.core.query.Query.query(
              org.springframework.data.mongodb.core.query.Criteria.where("_id").is(userId)),
          new org.springframework.data.mongodb.core.query.Update()
              .setOnInsert("displayName", displayName)
              .setOnInsert(
                  "normalizedDisplayName",
                  java.text.Normalizer.normalize(displayName, java.text.Normalizer.Form.NFKC)
                      .strip()
                      .replaceAll("\\s+", " ")
                      .toLowerCase(java.util.Locale.ROOT))
              .setOnInsert("bio", "")
              .setOnInsert("avatarPublicUrl", user.getString("avatarUrl"))
              .setOnInsert("createdAt", createdAt)
              .setOnInsert("updatedAt", updatedAt)
              .setOnInsert("version", 0L),
          "user_profiles");
      boolean active =
          user.get("accountStatus") == null
              || "ACTIVE".equals(String.valueOf(user.get("accountStatus")));
      template.upsert(
          org.springframework.data.mongodb.core.query.Query.query(
              org.springframework.data.mongodb.core.query.Criteria.where("_id").is(userId)),
          new org.springframework.data.mongodb.core.query.Update()
              .setOnInsert("profileVisibility", active ? "MEMBERS" : "PRIVATE")
              .setOnInsert("discoverableByName", active)
              .setOnInsert("allowMessageRequests", active)
              .setOnInsert("updatedAt", updatedAt)
              .setOnInsert("version", 0L),
          "user_privacy_settings");
    }
  }

  private Instant instant(Object value) {
    return value instanceof java.util.Date date
        ? date.toInstant()
        : value instanceof Instant instant ? instant : Instant.EPOCH;
  }
}
