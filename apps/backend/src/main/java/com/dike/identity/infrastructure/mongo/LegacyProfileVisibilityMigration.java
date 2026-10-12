package com.dike.identity.infrastructure.mongo;

import com.dike.shared.infrastructure.migration.MongoMigration;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

/** Normalizes the removed PUBLIC profile visibility before typed documents are read. */
@Component
class LegacyProfileVisibilityMigration implements MongoMigration {

  @Override
  public String id() {
    return "V015__legacy_profile_visibility";
  }

  @Override
  public String checksum() {
    return "sha256:legacy-profile-visibility-public-to-members-v1";
  }

  @Override
  public void apply(MongoTemplate template) {
    template.updateMulti(
        Query.query(Criteria.where("profileVisibility").is("PUBLIC")),
        new Update().set("profileVisibility", "MEMBERS"),
        "user_privacy_settings");
  }
}
