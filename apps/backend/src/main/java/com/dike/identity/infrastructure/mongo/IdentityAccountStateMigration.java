package com.dike.identity.infrastructure.mongo;

import com.dike.identity.domain.AccountStatus;
import com.dike.identity.domain.OnboardingStatus;
import com.dike.identity.domain.PhoneStatus;
import com.dike.identity.domain.VerificationEvidence;
import com.dike.shared.infrastructure.migration.MongoMigration;
import java.util.List;
import org.bson.Document;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.PartialIndexFilter;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

@Component
class IdentityAccountStateMigration implements MongoMigration {

  private static final String USERS = "users";

  @Override
  public String id() {
    return "V003__identity_account_state";
  }

  @Override
  public String checksum() {
    return "sha256:aa9a47f2eedc46fcb747b51489590a2fdd1d515b4a0608c05c38f621f1c62b27";
  }

  @Override
  public void apply(MongoTemplate template) {
    template.updateMulti(
        Query.query(
            Criteria.where("phoneE164").exists(false).and("phoneCandidateE164").exists(true)),
        new Update().rename("phoneCandidateE164", "phoneE164"),
        USERS);
    setDefaultWhenMissing(template, "accountStatus", AccountStatus.ACTIVE);
    setDefaultWhenMissing(template, "onboardingStatus", OnboardingStatus.PHONE_REQUIRED);
    setDefaultWhenMissing(template, "phoneStatus", PhoneStatus.NOT_PROVIDED);
    setDefaultWhenMissing(template, "phoneVersion", 0L);
    setDefaultWhenMissing(template, "verificationEvidence", VerificationEvidence.NONE);
    setDefaultWhenMissing(template, "assignedRoles", List.of());
    setDefaultWhenMissing(template, "authorizationVersion", 0L);

    rejectDuplicateVerifiedPhones(template);

    template
        .indexOps(USERS)
        .ensureIndex(
            new Index()
                .on("phoneE164", Sort.Direction.ASC)
                .unique()
                .partial(
                    PartialIndexFilter.of(
                        new Document("phoneStatus", "VERIFIED")
                            .append("phoneE164", new Document("$type", "string"))))
                .named("uq_user_verified_phone"));
  }

  private void rejectDuplicateVerifiedPhones(MongoTemplate template) {
    Document duplicate =
        template
            .getCollection(USERS)
            .aggregate(
                List.of(
                    new Document(
                        "$match",
                        new Document("phoneStatus", "VERIFIED")
                            .append("phoneE164", new Document("$type", "string"))),
                    new Document(
                        "$group",
                        new Document("_id", "$phoneE164").append("count", new Document("$sum", 1))),
                    new Document("$match", new Document("count", new Document("$gt", 1))),
                    new Document("$limit", 1)))
            .first();
    if (duplicate != null) {
      throw new IllegalStateException(
          "Cannot create verified phone index while duplicate verified phones exist");
    }
  }

  private void setDefaultWhenMissing(MongoTemplate template, String field, Object value) {
    template.updateMulti(
        Query.query(Criteria.where(field).exists(false)), new Update().set(field, value), USERS);
  }
}
