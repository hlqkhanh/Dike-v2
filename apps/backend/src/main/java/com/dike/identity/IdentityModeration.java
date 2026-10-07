package com.dike.identity;

import com.dike.identity.domain.AccountStatus;
import com.dike.shared.api.ApiException;
import com.dike.shared.outbox.OutboxPublisher;
import com.mongodb.client.result.UpdateResult;
import java.time.Clock;
import java.util.Map;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class IdentityModeration {
  private final IdentityAccess access;
  private final MongoTemplate mongo;
  private final OutboxPublisher outbox;
  private final Clock clock;

  public IdentityModeration(
      IdentityAccess access, MongoTemplate mongo, OutboxPublisher outbox, Clock clock) {
    this.access = access;
    this.mongo = mongo;
    this.outbox = outbox;
    this.clock = clock;
  }

  @Transactional
  public long setLocked(String adminId, String targetId, boolean locked, String reason) {
    if (!access.require(adminId).admin()) throw forbidden();
    if (targetId.equals(adminId) || reason == null || reason.isBlank() || reason.length() > 500)
      throw invalid();
    AccountStatus expected = locked ? AccountStatus.ACTIVE : AccountStatus.LOCKED;
    AccountStatus target = locked ? AccountStatus.LOCKED : AccountStatus.ACTIVE;
    UpdateResult result =
        mongo.updateFirst(
            Query.query(Criteria.where("_id").is(targetId).and("accountStatus").is(expected)),
            new Update()
                .set("accountStatus", target)
                .set("updatedAt", clock.instant())
                .inc("authorizationVersion", 1),
            "users");
    if (result.getModifiedCount() != 1)
      throw new ApiException(
          HttpStatus.CONFLICT,
          locked ? "ACCOUNT_ALREADY_LOCKED" : "ACCOUNT_NOT_LOCKED",
          "Trạng thái tài khoản không phù hợp");
    long version = access.require(targetId).authorizationVersion();
    outbox.publish(
        locked ? "account.locked" : "account.unlocked",
        "User",
        targetId,
        1,
        Map.of("userId", targetId, "authorizationVersion", version));
    return version;
  }

  private static ApiException forbidden() {
    return new ApiException(
        HttpStatus.FORBIDDEN, "ADMIN_REQUIRED", "Chỉ admin được thực hiện thao tác này");
  }

  private static ApiException invalid() {
    return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_ENFORCEMENT", "Lý do không hợp lệ");
  }
}
