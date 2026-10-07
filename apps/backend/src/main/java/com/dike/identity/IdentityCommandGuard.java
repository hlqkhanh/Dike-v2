package com.dike.identity;

import com.dike.shared.api.ApiException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

/** Conflicts with suspension, deletion and authorization changes in the same Mongo transaction. */
@Service
public class IdentityCommandGuard {
  private final MongoTemplate mongo;

  public IdentityCommandGuard(MongoTemplate mongo) {
    this.mongo = mongo;
  }

  @Transactional(propagation = Propagation.MANDATORY)
  public void fence(String id) {
    if (mongo
            .updateFirst(
                Query.query(Criteria.where("_id").is(id).and("accountStatus").is("ACTIVE")),
                new Update().inc("rideFence", 1L),
                "users")
            .getModifiedCount()
        != 1)
      throw new ApiException(
          HttpStatus.FORBIDDEN, "ACCOUNT_UNAVAILABLE", "Tài khoản không khả dụng");
  }
}
