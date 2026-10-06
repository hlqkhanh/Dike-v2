package com.dike.identity.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.dike.identity.domain.AuthIdentity;
import com.dike.identity.domain.UserAccount;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class IdentityProvisioningServiceTest {

  private final FakeIdentityStore store = new FakeIdentityStore();
  private final AtomicInteger sequence = new AtomicInteger();
  private final IdentityProvisioningService service =
      new IdentityProvisioningService(
          store,
          Clock.fixed(Instant.parse("2026-10-06T00:00:00Z"), ZoneOffset.UTC),
          () -> "id-" + sequence.incrementAndGet());

  @Test
  void provisionsOnceByIssuerAndSubject() {
    UserAccount first = service.provisionGoogle(claims("subject-1", "User@Example.com"));
    UserAccount second = service.provisionGoogle(claims("subject-1", "user@example.com"));

    assertThat(second.id()).isEqualTo(first.id());
    assertThat(first.canonicalEmail()).isEqualTo("user@example.com");
    assertThat(store.users).hasSize(1);
    assertThat(store.identities).hasSize(1);
  }

  @Test
  void refusesToMergeAnotherSubjectWithTheSameEmail() {
    service.provisionGoogle(claims("subject-1", "same@example.com"));

    assertThatThrownBy(() -> service.provisionGoogle(claims("subject-2", "same@example.com")))
        .isInstanceOf(AccountLinkRequiredException.class);
    assertThat(store.users).hasSize(1);
    assertThat(store.identities).hasSize(1);
  }

  @Test
  void requiresVerifiedGoogleEmail() {
    GoogleIdentityClaims invalid =
        new GoogleIdentityClaims(
            "https://accounts.google.com", "subject", "user@example.com", false, "User", null);

    assertThatThrownBy(() -> service.provisionGoogle(invalid))
        .isInstanceOf(IllegalArgumentException.class);
  }

  private GoogleIdentityClaims claims(String subject, String email) {
    return new GoogleIdentityClaims(
        "https://accounts.google.com", subject, email, true, "User", null);
  }

  private static final class FakeIdentityStore implements IdentityStore {

    private final Map<String, UserAccount> users = new HashMap<>();
    private final Map<String, AuthIdentity> identities = new HashMap<>();

    @Override
    public Optional<AuthIdentity> findIdentity(String issuer, String subject) {
      return identities.values().stream()
          .filter(value -> value.issuer().equals(issuer) && value.subject().equals(subject))
          .findFirst();
    }

    @Override
    public Optional<UserAccount> findUserById(String userId) {
      return Optional.ofNullable(users.get(userId));
    }

    @Override
    public Optional<UserAccount> findUserByCanonicalEmail(String canonicalEmail) {
      return users.values().stream()
          .filter(value -> value.canonicalEmail().equals(canonicalEmail))
          .findFirst();
    }

    @Override
    public UserAccount insertUser(UserAccount user) {
      users.put(user.id(), user);
      return user;
    }

    @Override
    public void insertIdentity(AuthIdentity identity) {
      identities.put(identity.id(), identity);
    }

    @Override
    public void updateIdentityLogin(String identityId, Instant lastLoginAt, String emailSnapshot) {
      AuthIdentity existing = identities.get(identityId);
      identities.put(
          identityId,
          new AuthIdentity(
              existing.id(),
              existing.provider(),
              existing.issuer(),
              existing.subject(),
              existing.userId(),
              emailSnapshot,
              existing.emailVerified(),
              existing.createdAt(),
              lastLoginAt));
    }

    @Override
    public UserAccount updatePhoneCandidate(
        String userId, long expectedPhoneVersion, String phoneE164, Instant updatedAt) {
      throw new UnsupportedOperationException();
    }
  }
}
