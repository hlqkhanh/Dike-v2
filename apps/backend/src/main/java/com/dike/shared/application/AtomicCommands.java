package com.dike.shared.application;

import com.dike.shared.api.ApiException;
import com.mongodb.MongoException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Duration;
import java.util.HexFormat;
import java.util.function.Supplier;
import org.bson.Document;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** Technical transaction/receipt primitive; resource authorization belongs to the caller. */
@Component
public class AtomicCommands {
  private final MongoTemplate mongo;
  private final TransactionTemplate transactions;
  private final Clock clock;

  public AtomicCommands(MongoTemplate mongo, PlatformTransactionManager manager, Clock clock) {
    this.mongo = mongo;
    this.transactions = new TransactionTemplate(manager);
    this.clock = clock;
  }

  public <T> T transaction(Supplier<T> action) {
    for (int attempt = 0; attempt < 5; attempt++) {
      try {
        return transactions.execute(ignored -> action.get());
      } catch (RuntimeException error) {
        boolean retry = false;
        for (Throwable cause = error; cause != null; cause = cause.getCause()) {
          if (cause instanceof DuplicateKeyException
              || cause instanceof OptimisticLockingFailureException) retry = true;
          if (cause instanceof MongoException e
              && (e.hasErrorLabel("TransientTransactionError")
                  || e.hasErrorLabel("UnknownTransactionCommitResult"))) retry = true;
        }
        if (!retry) throw error;
        if (attempt == 4)
          throw new ApiException(
              HttpStatus.CONFLICT, "CONCURRENT_CHANGE", "Dữ liệu đã thay đổi, vui lòng tải lại");
        java.util.concurrent.locks.LockSupport.parkNanos(
            java.time.Duration.ofMillis(10L << attempt).toNanos());
      }
    }
    throw new IllegalStateException();
  }

  public String execute(
      String actor, String operation, String key, String payload, Supplier<String> action) {
    if (key == null || !key.matches("[A-Za-z0-9_-]{8,100}"))
      throw new ApiException(
          HttpStatus.BAD_REQUEST, "INVALID_IDEMPOTENCY_KEY", "Idempotency key không hợp lệ");
    String id = digest(actor + "\n" + operation + "\n" + key);
    String fingerprint = digest(payload);
    return transaction(
        () -> {
          Document receipt = mongo.findById(id, Document.class, "command_receipts");
          if (receipt != null) {
            if (!fingerprint.equals(receipt.getString("fingerprint")))
              throw new ApiException(
                  HttpStatus.CONFLICT, "IDEMPOTENCY_CONFLICT", "Key đã dùng với yêu cầu khác");
            return receipt.getString("resourceId");
          }
          String resource = action.get();
          mongo.insert(
              new Document("_id", id)
                  .append("fingerprint", fingerprint)
                  .append("resourceId", resource)
                  .append(
                      "expiresAt", java.util.Date.from(clock.instant().plus(Duration.ofDays(30)))),
              "command_receipts");
          return resource;
        });
  }

  /** All writers competing on the invariant must touch the same guard inside their transaction. */
  public void fence(String scope, String id) {
    mongo.upsert(
        Query.query(Criteria.where("_id").is(scope + ":" + id)),
        new Update().inc("version", 1L),
        "command_guards");
  }

  private String digest(String value) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (java.security.NoSuchAlgorithmException error) {
      throw new IllegalStateException(error);
    }
  }
}
