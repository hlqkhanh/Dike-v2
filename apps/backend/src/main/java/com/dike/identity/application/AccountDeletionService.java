package com.dike.identity.application;

import com.dike.identity.domain.AccountDeletionRequest;
import com.dike.identity.domain.AccountDeletionState;
import com.dike.identity.infrastructure.profile.ProfileProperties;
import com.dike.shared.outbox.OutboxPublisher;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.function.Supplier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AccountDeletionService {

  public static final String EVENT = "identity.account.deletion-due";
  private static final Duration REAUTH_MAX_AGE = Duration.ofMinutes(5);
  private final ProfileDataStore store;
  private final ProfileProperties properties;
  private final OutboxPublisher events;
  private final Clock clock;
  private final Supplier<String> ids;

  public AccountDeletionService(
      ProfileDataStore store,
      ProfileProperties properties,
      OutboxPublisher events,
      Clock clock,
      Supplier<String> ids) {
    this.store = store;
    this.properties = properties;
    this.events = events;
    this.clock = clock;
    this.ids = ids;
  }

  public AccountDeletionRequest status(String userId) {
    return store.findActiveDeletion(userId).orElse(null);
  }

  @Transactional
  public AccountDeletionRequest request(
      String userId, Instant googleAuthenticatedAt, String idempotencyKey) {
    if (idempotencyKey == null || idempotencyKey.isBlank()) throw new InvalidRequestException();
    AccountDeletionRequest existing = store.findActiveDeletion(userId).orElse(null);
    if (existing != null) return existing;
    Instant now = clock.instant();
    if (googleAuthenticatedAt == null
        || googleAuthenticatedAt.isAfter(now)
        || googleAuthenticatedAt.isBefore(now.minus(REAUTH_MAX_AGE))) {
      throw new ReauthenticationRequiredException();
    }
    Instant executeAfter = now.plus(properties.deletion().waitingPeriod());
    AccountDeletionRequest request =
        store.insertDeletion(
            new AccountDeletionRequest(
                ids.get(),
                userId,
                AccountDeletionState.REQUESTED,
                now,
                executeAfter,
                null,
                properties.deletion().policyVersion(),
                0,
                null,
                0));
    store.markAccountDeletionRequested(userId, now);
    events.publishAt(
        EVENT,
        "AccountDeletionRequest",
        request.id(),
        1,
        Map.of("requestId", request.id(), "userId", userId),
        executeAfter);
    return request;
  }

  public static final class ReauthenticationRequiredException extends RuntimeException {}

  public static final class InvalidRequestException extends RuntimeException {}
}
