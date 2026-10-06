package com.dike.identity.infrastructure.mongo;

import com.dike.shared.infrastructure.migration.MongoMigration;
import java.time.Duration;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.CompoundIndexDefinition;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.stereotype.Component;

@Component
class OtpIndexesMigration implements MongoMigration {

  @Override
  public String id() {
    return "V004__otp_challenge_indexes";
  }

  @Override
  public String checksum() {
    return "sha256:45ce853de15e31f9ed302e3c2ee05e56f8e753be56c9ca045e29876d03215193";
  }

  @Override
  public void apply(MongoTemplate template) {
    template
        .indexOps("otp_challenges")
        .ensureIndex(
            new CompoundIndexDefinition(
                    new org.bson.Document("userId", 1)
                        .append("deviceSessionId", 1)
                        .append("requestKeyHash", 1))
                .unique()
                .named("uq_otp_issue_idempotency"));
    template
        .indexOps("otp_challenges")
        .ensureIndex(
            new CompoundIndexDefinition(
                    new org.bson.Document("userId", 1)
                        .append("phoneVersion", 1)
                        .append("createdAt", -1))
                .named("ix_otp_user_phone_created"));
    template
        .indexOps("otp_challenges")
        .ensureIndex(
            new Index()
                .on("purgeAt", Sort.Direction.ASC)
                .expire(Duration.ZERO)
                .named("ttl_otp_purge"));
  }
}
