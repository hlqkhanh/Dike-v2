package com.dike.identity.infrastructure;

import com.dike.identity.application.AccountStore;
import com.dike.identity.domain.Account;
import java.time.Clock;
import java.util.Date;
import java.util.UUID;
import org.bson.Document;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.MongoTransactionManager;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.support.TransactionTemplate;

@Repository
public class MongoAccountStore implements AccountStore {
  private final MongoTemplate mongo;
  private final TransactionTemplate tx;
  private final Clock clock;

  public MongoAccountStore(MongoTemplate mongo, MongoTransactionManager manager, Clock clock) {
    this.mongo = mongo;
    this.tx = new TransactionTemplate(manager);
    this.clock = clock;
  }

  private Query identity(String sub) {
    return Query.query(Criteria.where("provider").is("google").and("subject").is(sub));
  }

  public Account login(String sub, String name, String email) {
    for (int attempt = 0; attempt < 3; attempt++) {
      try {
        return tx.execute(
            status -> {
              Document existing = mongo.findOne(identity(sub), Document.class, "auth_identities");
              if (existing != null) return require(existing.getString("userId"));
              String id = UUID.randomUUID().toString();
              Date now = Date.from(clock.instant());
              mongo.insert(
                  new Document("_id", id)
                      .append("displayName", name)
                      .append("email", email)
                      .append("phoneStatus", "NONE")
                      .append("sessionVersion", 0L)
                      .append("version", 0L)
                      .append("createdAt", now)
                      .append("updatedAt", now),
                  "users");
              mongo.insert(
                  new Document("_id", UUID.randomUUID().toString())
                      .append("provider", "google")
                      .append("subject", sub)
                      .append("userId", id)
                      .append("createdAt", now),
                  "auth_identities");
              return require(id);
            });
      } catch (DuplicateKeyException ex) {
        Document existing = mongo.findOne(identity(sub), Document.class, "auth_identities");
        if (existing != null) return require(existing.getString("userId"));
        if (attempt == 2) throw ex;
      } catch (org.springframework.dao.TransientDataAccessException ex) {
        if (attempt == 2) throw ex;
      }
    }
    throw new IllegalStateException("Identity unavailable");
  }

  public Account require(String id) {
    Document row = mongo.findById(id, Document.class, "users");
    if (row == null) throw new IllegalStateException("Account unavailable");
    return new Account(
        id,
        row.getString("displayName"),
        row.getString("email"),
        row.getString("phoneE164"),
        row.getString("phoneStatus"),
        ((Number) row.get("sessionVersion")).longValue(),
        row.getDate("createdAt").toInstant(),
        row.getDate("updatedAt").toInstant());
  }

  public Account phone(String id, String phone) {
    mongo.updateFirst(
        Query.query(Criteria.where("_id").is(id)),
        new Update()
            .set("phoneE164", phone)
            .set("phoneStatus", "UNVERIFIED")
            .set("updatedAt", Date.from(clock.instant()))
            .inc("version", 1),
        "users");
    return require(id);
  }

  public void revokeAll(String id) {
    mongo.updateFirst(
        Query.query(Criteria.where("_id").is(id)),
        new Update().inc("sessionVersion", 1).inc("version", 1),
        "users");
  }
}
