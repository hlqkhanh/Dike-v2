package com.dike.identity.infrastructure.mongo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.dike.identity.application.IdentityStore;
import com.dike.identity.application.OtpOperations;
import com.dike.identity.application.OtpProvider;
import com.dike.identity.application.OtpRateLimiter;
import com.dike.identity.domain.AccountStatus;
import com.dike.identity.domain.AuthIdentity;
import com.dike.identity.domain.OnboardingStatus;
import com.dike.identity.domain.OtpChallengeStatus;
import com.dike.identity.domain.OtpPurpose;
import com.dike.identity.domain.PhoneStatus;
import com.dike.identity.domain.UserAccount;
import com.dike.identity.domain.VerificationEvidence;
import com.dike.identity.infrastructure.otp.OtpCodeProtector;
import com.dike.identity.infrastructure.otp.OtpProperties;
import com.dike.shared.outbox.OutboxPublisher;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.bson.Document;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.MongoTransactionManager;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.SimpleMongoClientDatabaseFactory;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Testcontainers(disabledWithoutDocker = true)
class MongoOtpServiceIT {

  @Container
  private static final MongoDBContainer MONGO =
      new MongoDBContainer(DockerImageName.parse("mongo:8.0.32-noble"));

  private static MongoClient client;
  private static MongoTemplate mongo;
  private static TransactionTemplate transactions;
  private final Instant now = Instant.parse("2026-10-06T00:00:00Z");
  private final AtomicReference<String> deliveredCode = new AtomicReference<>();
  private MongoOtpService service;

  @BeforeAll
  static void startMongo() {
    client = MongoClients.create(MONGO.getReplicaSetUrl());
    var factory = new SimpleMongoClientDatabaseFactory(client, "dike_stage3_otp_test");
    mongo = new MongoTemplate(factory);
    transactions = new TransactionTemplate(new MongoTransactionManager(factory));
  }

  @AfterAll
  static void stopMongo() {
    if (client != null) client.close();
  }

  @BeforeEach
  void setup() {
    mongo.getDb().drop();
    new OtpIndexesMigration().apply(mongo);
    mongo.insert(
        new Document("_id", "user-1")
            .append("phoneE164", "+84901234567")
            .append("phoneVersion", 1L)
            .append("phoneStatus", "UNVERIFIED")
            .append("authorizationVersion", 0L),
        "users");
    OtpProperties properties =
        new OtpProperties(
            "fake",
            "test-code-secret-with-enough-entropy",
            "test-rate-secret-with-enough-entropy",
            "test-v1",
            Duration.ofMinutes(5),
            Duration.ofMinutes(1),
            5,
            true,
            100);
    AtomicInteger ids = new AtomicInteger();
    OtpProvider provider =
        request -> {
          deliveredCode.set(request.code());
          return new OtpProvider.DeliveryResult(
              OtpProvider.DeliveryState.ACCEPTED, request.dispatchId(), null);
        };
    OtpRateLimiter limiter = mock(OtpRateLimiter.class);
    when(limiter.reserveIssue(anyString(), anyString(), anyString(), anyString()))
        .thenReturn(OtpRateLimiter.Decision.allowedDecision());
    when(limiter.reserveVerify(anyString(), anyString(), anyString(), anyString()))
        .thenReturn(OtpRateLimiter.Decision.allowedDecision());
    service =
        new MongoOtpService(
            mongo,
            new FixedIdentityStore(user()),
            provider,
            properties,
            new OtpCodeProtector(properties),
            limiter,
            mock(OutboxPublisher.class),
            transactions,
            Clock.fixed(now, ZoneOffset.UTC),
            () -> "id-" + ids.incrementAndGet());
  }

  @Test
  void issueIsIdempotentAndSuccessfulVerificationConsumesTheChallenge() {
    var first =
        service.issue("user-1", "device-1", "127.0.0.1", OtpPurpose.VERIFY_PHONE, 1, "key-1");
    var retry =
        service.issue("user-1", "device-1", "127.0.0.1", OtpPurpose.VERIFY_PHONE, 1, "key-1");

    assertThat(retry.challengeId()).isEqualTo(first.challengeId());
    assertThat(mongo.getCollection("otp_challenges").countDocuments()).isEqualTo(1);

    service.verify(
        "user-1", "device-1", "127.0.0.1", first.challengeId(), deliveredCode.get(), "verify-1");

    Document user = mongo.findById("user-1", Document.class, "users");
    assertThat(user.getString("phoneStatus")).isEqualTo("VERIFIED");
    assertThat(user.getString("verificationEvidence")).isEqualTo("SIMULATED");
    assertThat(service.status("user-1", "device-1", first.challengeId()).status())
        .isEqualTo(OtpChallengeStatus.CONSUMED);
  }

  @Test
  void wrongCodeConsumesAnAttemptWithoutConsumingTheChallenge() {
    var challenge =
        service.issue("user-1", "device-1", "127.0.0.1", OtpPurpose.VERIFY_PHONE, 1, "key-1");
    String wrongCode = "000000".equals(deliveredCode.get()) ? "000001" : "000000";

    assertThatThrownBy(
            () ->
                service.verify(
                    "user-1",
                    "device-1",
                    "127.0.0.1",
                    challenge.challengeId(),
                    wrongCode,
                    "verify-1"))
        .isInstanceOf(OtpOperations.OtpException.class);

    OtpChallengeDocument stored =
        mongo.findById(challenge.challengeId(), OtpChallengeDocument.class);
    assertThat(stored.attemptsUsed()).isEqualTo(1);
    assertThat(stored.status()).isEqualTo(OtpChallengeStatus.ACTIVE);
  }

  private UserAccount user() {
    return new UserAccount(
        "user-1",
        "user@example.com",
        "User",
        null,
        AccountStatus.ACTIVE,
        OnboardingStatus.PHONE_SUBMITTED,
        "+84901234567",
        PhoneStatus.UNVERIFIED,
        1,
        null,
        VerificationEvidence.NONE,
        Set.of(),
        0,
        now,
        now,
        0);
  }

  private record FixedIdentityStore(UserAccount user) implements IdentityStore {
    @Override
    public Optional<AuthIdentity> findIdentity(String issuer, String subject) {
      return Optional.empty();
    }

    @Override
    public Optional<UserAccount> findUserById(String userId) {
      return Optional.of(user);
    }

    @Override
    public Optional<UserAccount> findUserByCanonicalEmail(String email) {
      return Optional.empty();
    }

    @Override
    public UserAccount insertUser(UserAccount value) {
      throw new UnsupportedOperationException();
    }

    @Override
    public void insertIdentity(AuthIdentity identity) {
      throw new UnsupportedOperationException();
    }

    @Override
    public void updateIdentityLogin(String id, Instant at, String email) {
      throw new UnsupportedOperationException();
    }

    @Override
    public UserAccount updatePhoneCandidate(String id, long version, String phone, Instant at) {
      throw new UnsupportedOperationException();
    }
  }
}
