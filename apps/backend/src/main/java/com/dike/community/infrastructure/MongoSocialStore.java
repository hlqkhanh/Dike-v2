package com.dike.community.infrastructure;

import com.dike.community.application.SocialStore;
import com.dike.community.domain.SocialRelation;
import com.dike.community.domain.SocialRelation.Status;
import com.dike.shared.api.ApiException;
import com.dike.shared.outbox.OutboxPublisher;
import com.mongodb.MongoException;
import com.mongodb.ReadPreference;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;
import org.bson.Document;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Repository
public class MongoSocialStore implements SocialStore {
  private final MongoTemplate mongo;
  private final TransactionTemplate transactions;
  private final OutboxPublisher outbox;

  public MongoSocialStore(
      MongoTemplate mongo, PlatformTransactionManager manager, OutboxPublisher outbox) {
    this.mongo = mongo;
    this.transactions = new TransactionTemplate(manager);
    this.outbox = outbox;
  }

  @Override
  public <T> T transaction(Supplier<T> work) {
    for (int attempt = 0; attempt < 5; attempt++) {
      try {
        return transactions.execute(status -> work.get());
      } catch (RuntimeException error) {
        if (!retryable(error)) throw error;
        if (attempt == 4)
          throw new ApiException(
              HttpStatus.CONFLICT,
              "SOCIAL_STATE_CONFLICT",
              "Trạng thái đang thay đổi, vui lòng thử lại");
      }
    }
    throw new IllegalStateException("Unreachable");
  }

  private boolean retryable(Throwable error) {
    for (Throwable cause = error; cause != null; cause = cause.getCause()) {
      if (cause instanceof DuplicateKeyException
          || cause instanceof OptimisticLockingFailureException) return true;
      if (cause instanceof MongoException mongoError
          && (mongoError.hasErrorLabel("TransientTransactionError")
              || mongoError.hasErrorLabel("UnknownTransactionCommitResult"))) return true;
    }
    return false;
  }

  private Query query(Criteria criteria) {
    return Query.query(criteria).withReadPreference(ReadPreference.primary());
  }

  @Override
  public void purgeUser(String actor) {
    invalidateProfiles();
    var scope =
        query(
            new Criteria()
                .orOperator(Criteria.where("low").is(actor), Criteria.where("high").is(actor)));
    var relations = mongo.find(scope, Document.class, "social_relations");
    var ids = relations.stream().map(d -> d.getString("_id")).toList();
    for (Document row : relations) {
      String other =
          actor.equals(row.getString("low")) ? row.getString("high") : row.getString("low");
      mongo.upsert(
          query(Criteria.where("_id").is(other)),
          new Update().inc("revision", 1L),
          "social_revisions");
    }
    mongo.remove(scope, "social_relations");
    mongo.remove(
        query(
            new Criteria()
                .orOperator(
                    Criteria.where("actor").is(actor), Criteria.where("relationId").in(ids))),
        "social_receipts");
    mongo.remove(query(Criteria.where("relationId").in(ids)), "social_audit");
    mongo.remove(query(Criteria.where("_id").in(ids)), "social_delivery_watermarks");
    mongo.remove(
        query(Criteria.where("aggregateType").is("SocialRelation").and("aggregateId").in(ids)),
        "outbox_events");
    mongo.remove(query(Criteria.where("_id").is(actor)), "social_quotas");
    mongo.remove(query(Criteria.where("_id").is(actor)), "social_revisions");
  }

  @Override
  public Optional<SocialRelation> pair(String a, String b) {
    String id = SocialRelation.empty(a, b, Instant.EPOCH).id();
    return Optional.ofNullable(
            mongo.findOne(query(Criteria.where("_id").is(id)), Document.class, "social_relations"))
        .map(this::relation);
  }

  @Override
  public Optional<SocialRelation> invitation(String id) {
    return Optional.ofNullable(
            mongo.findOne(
                query(Criteria.where("requestId").is(id)), Document.class, "social_relations"))
        .map(this::relation);
  }

  @Override
  public void save(SocialRelation before, SocialRelation after, String actor, String action) {
    mongo.upsert(
        query(Criteria.where("_id").is("social:" + after.id())),
        new Update().inc("version", 1L),
        "command_guards");
    Document doc =
        new Document("_id", after.id())
            .append("low", after.low())
            .append("high", after.high())
            .append("status", after.status().name())
            .append("requester", after.requester())
            .append("requestId", after.requestId())
            .append("cooldownUntil", date(after.cooldownUntil()))
            .append("blockedBy", List.copyOf(after.blockedBy()))
            .append("version", after.version())
            .append("updatedAt", date(after.updatedAt()));
    if (before.version() == 0) mongo.insert(doc, "social_relations");
    else {
      var result =
          mongo.replace(
              query(Criteria.where("_id").is(before.id()).and("version").is(before.version())),
              doc,
              "social_relations");
      if (result.getModifiedCount() != 1)
        throw new OptimisticLockingFailureException("Relation changed");
    }
    // Synchronous revisions guarantee polling sees a committed revocation even if the worker is
    // down.
    for (String user : List.of(after.low(), after.high())) {
      mongo.upsert(
          query(Criteria.where("_id").is(user)),
          new Update().inc("revision", 1L),
          "social_revisions");
    }
    outbox.publish(
        "social.relationship.changed",
        "SocialRelation",
        after.id(),
        1,
        Map.of(
            "low",
            after.low(),
            "high",
            after.high(),
            "relationVersion",
            after.version(),
            "action",
            action));
    mongo.insert(
        new Document("actor", actor)
            .append("relationId", after.id())
            .append("action", action)
            .append("version", after.version())
            .append("createdAt", date(after.updatedAt())),
        "social_audit");
  }

  @Override
  public List<SocialRelation> list(String actor, String kind, String after, int limit) {
    Criteria scope =
        new Criteria()
            .orOperator(Criteria.where("low").is(actor), Criteria.where("high").is(actor));
    Criteria filter =
        switch (kind) {
          case "friends" -> Criteria.where("status").is("ACCEPTED").and("blockedBy").size(0);
          case "incoming" ->
              Criteria.where("status")
                  .is("PENDING")
                  .and("requester")
                  .ne(actor)
                  .and("blockedBy")
                  .size(0);
          case "outgoing" ->
              Criteria.where("status")
                  .is("PENDING")
                  .and("requester")
                  .is(actor)
                  .and("blockedBy")
                  .size(0);
          case "blocks" -> Criteria.where("blockedBy").is(actor);
          default -> throw new IllegalArgumentException("Unknown list");
        };
    Criteria criteria =
        new Criteria()
            .andOperator(
                scope, filter, after == null ? new Criteria() : Criteria.where("_id").gt(after));
    return mongo
        .find(query(criteria).with(Sort.by("_id")).limit(limit), Document.class, "social_relations")
        .stream()
        .map(this::relation)
        .toList();
  }

  private String receiptId(String actor, String key) {
    return actor.length() + ":" + actor + key;
  }

  @Override
  public Optional<String> receipt(String actor, String key) {
    return Optional.ofNullable(
            mongo.findById(receiptId(actor, key), Document.class, "social_receipts"))
        .map(d -> d.getString("fingerprint"));
  }

  @Override
  public void receipt(
      String actor, String key, String fingerprint, String relationId, Instant now) {
    mongo.insert(
        new Document("_id", receiptId(actor, key))
            .append("fingerprint", fingerprint)
            .append("actor", actor)
            .append("relationId", relationId)
            .append("expiresAt", date(now.plus(Duration.ofDays(8)))),
        "social_receipts");
  }

  @Override
  public void acquireSendQuota(String actor, Instant now) {
    // Serialize every send by this actor, including sends to different pairs, in the same
    // transaction.
    Document previous = mongo.findById(actor, Document.class, "social_quotas");
    long hour = now.getEpochSecond() / 3600;
    long day = now.getEpochSecond() / 86400;
    int hourly =
        previous != null && previous.getLong("hour") == hour ? previous.getInteger("hourly") : 0;
    int daily =
        previous != null && previous.getLong("day") == day ? previous.getInteger("daily") : 0;
    if (hourly >= 10 || daily >= 30)
      throw new ApiException(
          HttpStatus.TOO_MANY_REQUESTS,
          "SOCIAL_RATE_LIMITED",
          "Bạn đã gửi nhiều lời mời, vui lòng thử lại sau",
          Duration.ofHours(hourly >= 10 ? 1 : 24));
    var quota =
        new Document("_id", actor)
            .append("hour", hour)
            .append("day", day)
            .append("hourly", hourly + 1)
            .append("daily", daily + 1);
    if (previous == null) mongo.insert(quota, "social_quotas");
    else mongo.replace(query(Criteria.where("_id").is(actor)), quota, "social_quotas");
    long pending =
        mongo.count(
            query(Criteria.where("requester").is(actor).and("status").is("PENDING")),
            "social_relations");
    if (pending >= 100)
      throw new ApiException(
          HttpStatus.TOO_MANY_REQUESTS,
          "SOCIAL_PENDING_LIMIT",
          "Hãy rút bớt lời mời đang chờ",
          Duration.ofHours(1));
  }

  @Override
  public long revision(String actor) {
    Document value =
        mongo.findOne(query(Criteria.where("_id").is(actor)), Document.class, "social_revisions");
    Document global =
        mongo.findOne(query(Criteria.where("_id").is("profiles")), Document.class, "social_global");
    return (value == null ? 0 : ((Number) value.get("revision")).longValue())
        + (global == null ? 0 : ((Number) global.get("revision")).longValue());
  }

  @Override
  public void invalidateProfiles() {
    mongo.upsert(
        query(Criteria.where("_id").is("profiles")),
        new Update().inc("revision", 1L),
        "social_global");
  }

  private Date date(Instant value) {
    return value == null ? null : Date.from(value);
  }

  private SocialRelation relation(Document d) {
    Date cooldown = d.getDate("cooldownUntil");
    return new SocialRelation(
        d.getString("_id"),
        d.getString("low"),
        d.getString("high"),
        Status.valueOf(d.getString("status")),
        d.getString("requester"),
        d.getString("requestId"),
        cooldown == null ? null : cooldown.toInstant(),
        new HashSet<>(d.getList("blockedBy", String.class)),
        ((Number) d.get("version")).longValue(),
        d.getDate("updatedAt").toInstant());
  }
}
