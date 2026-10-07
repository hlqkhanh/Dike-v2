package com.dike.identity.infrastructure.mongo;

import com.dike.identity.application.AccountAccessService;
import com.dike.identity.application.AccountAuthority;
import com.dike.identity.domain.AccountStatus;
import com.dike.planning.PostAccounts;
import com.dike.ride.RideEligibility;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.stereotype.Component;

@Component
class IdentityRideAccess implements RideEligibility, PostAccounts {
  private final AccountAccessService access;
  private final MongoTemplate mongo;

  IdentityRideAccess(AccountAccessService access, MongoTemplate mongo) {
    this.access = access;
    this.mongo = mongo;
  }

  public boolean active(String id) {
    try {
      return access.require(id).accountStatus() == AccountStatus.ACTIVE;
    } catch (IllegalStateException missing) {
      return false;
    }
  }

  public boolean verified(String id) {
    return active(id)
        && access.require(id).authorities().contains(AccountAuthority.VERIFIED_MEMBER);
  }

  public boolean driver(String id) {
    return active(id)
        && access.require(id).authorities().contains(AccountAuthority.APPROVED_DRIVER);
  }

  public void fence(String id) {
    if (mongo
            .updateFirst(
                Query.query(Criteria.where("_id").is(id).and("accountStatus").is("ACTIVE")),
                new Update().inc("rideFence", 1L),
                "users")
            .getModifiedCount()
        != 1)
      throw new com.dike.shared.api.ApiException(
          org.springframework.http.HttpStatus.FORBIDDEN,
          "ACCOUNT_UNAVAILABLE",
          "Tài khoản không khả dụng");
  }
}
