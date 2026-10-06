package com.dike.identity.infrastructure.admin;

import com.dike.identity.domain.AccountRole;
import com.dike.shared.outbox.OutboxPublisher;
import java.time.Clock;
import java.util.Map;
import org.bson.Document;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class AdminBootstrapService {

  private final MongoTemplate mongo;
  private final OutboxPublisher outbox;
  private final Clock clock;

  AdminBootstrapService(MongoTemplate mongo, OutboxPublisher outbox, Clock clock) {
    this.mongo = mongo;
    this.outbox = outbox;
    this.clock = clock;
  }

  @Transactional
  Result grant(String accountId, String operator, String reason, boolean dryRun) {
    Document account = mongo.findById(accountId, Document.class, "users");
    if (account == null)
      throw new IllegalArgumentException("Admin bootstrap account does not exist");
    if (hasAdminRole(account)) return Result.ALREADY_ASSIGNED;
    if (dryRun) return Result.WOULD_ASSIGN;

    Document updated =
        mongo.findAndModify(
            Query.query(
                Criteria.where("_id")
                    .is(accountId)
                    .and("assignedRoles")
                    .ne(AccountRole.ADMIN.name())),
            new Update()
                .addToSet("assignedRoles", AccountRole.ADMIN)
                .inc("authorizationVersion", 1)
                .set("updatedAt", clock.instant()),
            FindAndModifyOptions.options().returnNew(true),
            Document.class,
            "users");
    if (updated == null) return Result.ALREADY_ASSIGNED;

    outbox.publish(
        "identity.admin-role-assigned",
        "UserAccount",
        accountId,
        1,
        Map.of("operator", operator, "reason", reason));
    return Result.ASSIGNED;
  }

  private boolean hasAdminRole(Document account) {
    return account.getList("assignedRoles", Object.class, java.util.List.of()).stream()
        .anyMatch(value -> AccountRole.ADMIN.name().equals(String.valueOf(value)));
  }

  enum Result {
    WOULD_ASSIGN,
    ASSIGNED,
    ALREADY_ASSIGNED
  }
}
