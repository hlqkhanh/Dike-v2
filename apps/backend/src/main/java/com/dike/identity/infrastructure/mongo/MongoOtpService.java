package com.dike.identity.infrastructure.mongo;

import com.dike.identity.application.IdentityStore;
import com.dike.identity.application.OtpOperations;
import com.dike.identity.application.OtpProvider;
import com.dike.identity.application.OtpRateLimiter;
import com.dike.identity.domain.OtpChallengeStatus;
import com.dike.identity.domain.OtpPurpose;
import com.dike.identity.domain.PhoneStatus;
import com.dike.identity.domain.VerificationEvidence;
import com.dike.identity.infrastructure.otp.OtpCodeProtector;
import com.dike.identity.infrastructure.otp.OtpProperties;
import com.dike.shared.outbox.OutboxPublisher;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.function.Supplier;
import org.bson.Document;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
class MongoOtpService implements OtpOperations {

  private final MongoTemplate mongo;
  private final IdentityStore identities;
  private final OtpProvider provider;
  private final OtpProperties properties;
  private final OtpCodeProtector protector;
  private final OtpRateLimiter limiter;
  private final OutboxPublisher outbox;
  private final TransactionTemplate transactions;
  private final Clock clock;
  private final Supplier<String> identifiers;
  private final SecureRandom random = new SecureRandom();

  MongoOtpService(
      MongoTemplate mongo,
      IdentityStore identities,
      OtpProvider provider,
      OtpProperties properties,
      OtpCodeProtector protector,
      OtpRateLimiter limiter,
      OutboxPublisher outbox,
      TransactionTemplate transactions,
      Clock clock,
      Supplier<String> identifiers) {
    this.mongo = mongo;
    this.identities = identities;
    this.provider = provider;
    this.properties = properties;
    this.protector = protector;
    this.limiter = limiter;
    this.outbox = outbox;
    this.transactions = transactions;
    this.clock = clock;
    this.identifiers = identifiers;
  }

  @Override
  public ChallengeView issue(
      String userId,
      String deviceSessionId,
      String clientIp,
      OtpPurpose purpose,
      long phoneVersion,
      String requestKey) {
    if (!properties.sendEnabled()) throw error(Reason.SEND_DISABLED);
    var user = identities.findUserById(userId).orElseThrow(() -> error(Reason.PHONE_REQUIRED));
    if (user.phoneE164() == null) throw error(Reason.PHONE_REQUIRED);
    if (user.phoneVersion() != phoneVersion) throw error(Reason.PHONE_STATE_CHANGED);
    String phoneKey = protector.phoneKey(user.phoneE164());
    String requestHash = protector.phoneKey("issue\u001f" + requestKey);
    Query idempotency =
        Query.query(
            Criteria.where("userId")
                .is(userId)
                .and("deviceSessionId")
                .is(deviceSessionId)
                .and("requestKeyHash")
                .is(requestHash));
    OtpChallengeDocument existing = mongo.findOne(idempotency, OtpChallengeDocument.class);
    if (existing != null) {
      if (existing.phoneVersion() != phoneVersion || existing.purpose() != purpose) {
        throw error(Reason.PHONE_STATE_CHANGED);
      }
      return view(existing, user.phoneE164());
    }

    Instant now = clock.instant();
    OtpChallengeDocument latest =
        mongo.findOne(
            Query.query(Criteria.where("userId").is(userId).and("phoneVersion").is(phoneVersion))
                .with(org.springframework.data.domain.Sort.by("createdAt").descending()),
            OtpChallengeDocument.class);
    if (latest != null && latest.resendAfter().isAfter(now)) {
      throw new OtpException(Reason.RATE_LIMITED, Duration.between(now, latest.resendAfter()));
    }
    var limit = limiter.reserveIssue(userId, phoneKey, deviceSessionId, clientIp);
    if (!limit.allowed()) throw new OtpException(Reason.RATE_LIMITED, limit.retryAfter());

    String code = "%06d".formatted(random.nextInt(1_000_000));
    String challengeId = identifiers.get();
    String dispatchId = identifiers.get();
    long generation = nextGeneration(userId, phoneVersion);
    OtpChallengeDocument challenge =
        new OtpChallengeDocument(
            challengeId,
            userId,
            deviceSessionId,
            phoneVersion,
            phoneKey,
            purpose,
            generation,
            OtpChallengeStatus.PENDING_DELIVERY,
            protector.codeMac(challengeId, userId, phoneVersion, purpose.name(), generation, code),
            properties.keyVersion(),
            0,
            now.plus(properties.lifetime()),
            now.plus(properties.resendCooldown()),
            requestHash,
            now,
            null,
            now.plus(24, ChronoUnit.HOURS),
            dispatchId,
            null,
            null);
    try {
      transactions.executeWithoutResult(
          ignored -> {
            mongo.updateMulti(
                Query.query(
                    Criteria.where("userId")
                        .is(userId)
                        .and("phoneVersion")
                        .is(phoneVersion)
                        .and("status")
                        .in(
                            OtpChallengeStatus.ACTIVE,
                            OtpChallengeStatus.PENDING_DELIVERY,
                            OtpChallengeStatus.DELIVERY_UNKNOWN)),
                new Update().set("status", OtpChallengeStatus.SUPERSEDED).unset("codeMac"),
                OtpChallengeDocument.class);
            mongo.insert(challenge);
            reserveDailyBudget(now);
          });
    } catch (DuplicateKeyException duplicate) {
      return view(mongo.findOne(idempotency, OtpChallengeDocument.class), user.phoneE164());
    }

    OtpProvider.DeliveryResult delivery =
        provider.send(new OtpProvider.DeliveryRequest(dispatchId, user.phoneE164(), code));
    OtpChallengeStatus deliveryStatus =
        switch (delivery.state()) {
          case ACCEPTED -> OtpChallengeStatus.ACTIVE;
          case REJECTED -> OtpChallengeStatus.DELIVERY_FAILED;
          case UNKNOWN -> OtpChallengeStatus.DELIVERY_UNKNOWN;
        };
    mongo.updateFirst(
        Query.query(
            Criteria.where("_id")
                .is(challengeId)
                .and("status")
                .is(OtpChallengeStatus.PENDING_DELIVERY)),
        new Update()
            .set("status", deliveryStatus)
            .set("providerReference", delivery.providerReference())
            .set("errorCategory", delivery.errorCategory()),
        OtpChallengeDocument.class);
    OtpChallengeDocument delivered = mongo.findById(challengeId, OtpChallengeDocument.class);
    if (delivered.status() == OtpChallengeStatus.DELIVERY_FAILED) {
      throw error(Reason.DELIVERY_FAILED);
    }
    return view(delivered, user.phoneE164());
  }

  @Override
  public ChallengeView status(String userId, String deviceSessionId, String challengeId) {
    OtpChallengeDocument challenge = owned(userId, deviceSessionId, challengeId);
    String phone = identities.findUserById(userId).map(value -> value.phoneE164()).orElse(null);
    return view(challenge, phone);
  }

  @Override
  public void verify(
      String userId,
      String deviceSessionId,
      String clientIp,
      String challengeId,
      String code,
      String requestKey) {
    String verifyRequestId =
        userId + ":" + deviceSessionId + ":" + protector.phoneKey("verify\u001f" + requestKey);
    String payloadHash = protector.phoneKey("verify-payload\u001f" + challengeId + "\u001f" + code);
    Document previous = mongo.findById(verifyRequestId, Document.class, "otp_verify_requests");
    if (previous != null) {
      if (!payloadHash.equals(previous.getString("payloadHash"))) {
        throw error(Reason.PHONE_STATE_CHANGED);
      }
      if ("SUCCESS".equals(previous.getString("outcome"))) return;
      throw error(Reason.CODE_INVALID);
    }
    OtpChallengeDocument rateSubject = findOwned(userId, deviceSessionId, challengeId);
    String ratePhoneKey =
        rateSubject == null ? protector.phoneKey("unknown-challenge") : rateSubject.phoneKey();
    var limit = limiter.reserveVerify(userId, ratePhoneKey, deviceSessionId, clientIp);
    if (!limit.allowed()) throw new OtpException(Reason.RATE_LIMITED, limit.retryAfter());
    if (rateSubject == null) throw error(Reason.CHALLENGE_NOT_FOUND);
    VerifyOutcome outcome;
    try {
      outcome =
          transactions.execute(
              ignored -> {
                Document concurrentRequest =
                    mongo.findById(verifyRequestId, Document.class, "otp_verify_requests");
                if (concurrentRequest != null) {
                  if (!payloadHash.equals(concurrentRequest.getString("payloadHash"))) {
                    return VerifyOutcome.PHONE_CHANGED;
                  }
                  return "SUCCESS".equals(concurrentRequest.getString("outcome"))
                      ? VerifyOutcome.SUCCESS
                      : VerifyOutcome.INVALID;
                }
                OtpChallengeDocument challenge = owned(userId, deviceSessionId, challengeId);
                Instant now = clock.instant();
                if (challenge.status() != OtpChallengeStatus.ACTIVE) {
                  return VerifyOutcome.NOT_ACTIVE;
                }
                if (!challenge.expiresAt().isAfter(now)) {
                  terminal(challengeId, OtpChallengeStatus.EXPIRED, now);
                  return VerifyOutcome.NOT_ACTIVE;
                }
                var user =
                    identities.findUserById(userId).orElseThrow(() -> error(Reason.PHONE_REQUIRED));
                if (user.phoneVersion() != challenge.phoneVersion()) {
                  terminal(challengeId, OtpChallengeStatus.SUPERSEDED, now);
                  return VerifyOutcome.PHONE_CHANGED;
                }
                boolean valid =
                    protector.matches(
                        challenge.codeMac(),
                        challenge.id(),
                        challenge.userId(),
                        challenge.phoneVersion(),
                        challenge.purpose().name(),
                        challenge.generation(),
                        code);
                if (!valid) {
                  int attempts = challenge.attemptsUsed() + 1;
                  Update update = new Update().set("attemptsUsed", attempts);
                  if (attempts >= properties.maximumAttempts()) {
                    update.set("status", OtpChallengeStatus.LOCKED).unset("codeMac");
                  }
                  mongo.updateFirst(
                      Query.query(Criteria.where("_id").is(challengeId)),
                      update,
                      OtpChallengeDocument.class);
                  mongo.insert(
                      new Document("_id", verifyRequestId)
                          .append("payloadHash", payloadHash)
                          .append("outcome", "INVALID")
                          .append("createdAt", now),
                      "otp_verify_requests");
                  return VerifyOutcome.INVALID;
                }
                var result =
                    mongo.updateFirst(
                        Query.query(
                            Criteria.where("_id")
                                .is(userId)
                                .and("phoneVersion")
                                .is(challenge.phoneVersion())),
                        new Update()
                            .set("phoneStatus", PhoneStatus.VERIFIED)
                            .set("phoneVerifiedAt", now)
                            .set("verificationEvidence", VerificationEvidence.SIMULATED)
                            .inc("authorizationVersion", 1),
                        "users");
                if (result.getModifiedCount() != 1) throw error(Reason.PHONE_STATE_CHANGED);
                terminal(challengeId, OtpChallengeStatus.CONSUMED, now);
                mongo.insert(
                    new Document("_id", verifyRequestId)
                        .append("payloadHash", payloadHash)
                        .append("outcome", "SUCCESS")
                        .append("createdAt", now),
                    "otp_verify_requests");
                outbox.publish(
                    "identity.phone-verified",
                    "UserAccount",
                    userId,
                    1,
                    Map.of("evidence", VerificationEvidence.SIMULATED.name()));
                return VerifyOutcome.SUCCESS;
              });
    } catch (DuplicateKeyException concurrentRetry) {
      Document winner = mongo.findById(verifyRequestId, Document.class, "otp_verify_requests");
      if (winner == null || !payloadHash.equals(winner.getString("payloadHash"))) {
        throw concurrentRetry;
      }
      outcome =
          "SUCCESS".equals(winner.getString("outcome"))
              ? VerifyOutcome.SUCCESS
              : VerifyOutcome.INVALID;
    }
    if (outcome == VerifyOutcome.SUCCESS) return;
    if (outcome == VerifyOutcome.PHONE_CHANGED) throw error(Reason.PHONE_STATE_CHANGED);
    if (outcome == VerifyOutcome.NOT_ACTIVE) throw error(Reason.CHALLENGE_NOT_ACTIVE);
    throw error(Reason.CODE_INVALID);
  }

  @Override
  public void cancel(String userId, String deviceSessionId, String challengeId) {
    owned(userId, deviceSessionId, challengeId);
    terminal(challengeId, OtpChallengeStatus.CANCELLED, clock.instant());
  }

  private long nextGeneration(String userId, long phoneVersion) {
    String id = userId + ":" + phoneVersion;
    Document value =
        mongo.findAndModify(
            Query.query(Criteria.where("_id").is(id)),
            new Update().inc("value", 1),
            FindAndModifyOptions.options().upsert(true).returnNew(true),
            Document.class,
            "otp_generations");
    return ((Number) value.get("value")).longValue();
  }

  private void reserveDailyBudget(Instant now) {
    String id = now.atZone(java.time.ZoneOffset.UTC).toLocalDate().toString();
    try {
      Document ledger =
          mongo.findAndModify(
              Query.query(
                  Criteria.where("_id")
                      .is(id)
                      .orOperator(
                          Criteria.where("count").lt(properties.dailyCap()),
                          Criteria.where("count").exists(false))),
              new Update().inc("count", 1).setOnInsert("createdAt", now),
              FindAndModifyOptions.options().upsert(true).returnNew(true),
              Document.class,
              "otp_send_budget");
      if (ledger == null) throw new OtpException(Reason.RATE_LIMITED, Duration.ofHours(1));
    } catch (DuplicateKeyException exhausted) {
      throw new OtpException(Reason.RATE_LIMITED, Duration.ofHours(1));
    }
  }

  private OtpChallengeDocument owned(String userId, String device, String id) {
    OtpChallengeDocument result = findOwned(userId, device, id);
    if (result == null) throw error(Reason.CHALLENGE_NOT_FOUND);
    return result;
  }

  private OtpChallengeDocument findOwned(String userId, String device, String id) {
    return mongo.findOne(
        Query.query(
            Criteria.where("_id")
                .is(id)
                .and("userId")
                .is(userId)
                .and("deviceSessionId")
                .is(device)),
        OtpChallengeDocument.class);
  }

  private void terminal(String id, OtpChallengeStatus status, Instant now) {
    mongo.updateFirst(
        Query.query(
            Criteria.where("_id")
                .is(id)
                .and("status")
                .in(
                    OtpChallengeStatus.ACTIVE,
                    OtpChallengeStatus.PENDING_DELIVERY,
                    OtpChallengeStatus.DELIVERY_UNKNOWN)),
        new Update().set("status", status).set("consumedAt", now).unset("codeMac"),
        OtpChallengeDocument.class);
  }

  private enum VerifyOutcome {
    SUCCESS,
    INVALID,
    NOT_ACTIVE,
    PHONE_CHANGED
  }

  private ChallengeView view(OtpChallengeDocument value, String phone) {
    return new ChallengeView(
        value.id(), value.status(), value.expiresAt(), value.resendAfter(), mask(phone));
  }

  private String mask(String phone) {
    if (phone == null || phone.length() < 6) return null;
    return phone.substring(0, 4) + "••••" + phone.substring(phone.length() - 3);
  }

  private OtpException error(Reason reason) {
    return new OtpException(reason);
  }
}
