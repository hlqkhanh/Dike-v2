package com.dike.identity.application;

import com.dike.identity.domain.AccountStatus;
import com.dike.identity.domain.AuthIdentity;
import com.dike.identity.domain.AuthProvider;
import com.dike.identity.domain.OnboardingStatus;
import com.dike.identity.domain.PhoneStatus;
import com.dike.identity.domain.UserAccount;
import java.time.Clock;
import java.time.Instant;
import java.util.Locale;
import java.util.Set;
import java.util.function.Supplier;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class IdentityProvisioningService {

  private final IdentityStore store;
  private final Clock clock;
  private final Supplier<String> identifiers;

  public IdentityProvisioningService(
      IdentityStore store, Clock clock, Supplier<String> identifierGenerator) {
    this.store = store;
    this.clock = clock;
    this.identifiers = identifierGenerator;
  }

  @Transactional
  public UserAccount provisionGoogle(GoogleIdentityClaims claims) {
    if (!claims.emailVerified()) {
      throw new IllegalArgumentException("Google email must be verified");
    }

    Instant now = clock.instant();
    var existing = store.findIdentity(claims.issuer(), claims.subject());
    if (existing.isPresent()) {
      AuthIdentity identity = existing.get();
      UserAccount user =
          store
              .findUserById(identity.userId())
              .orElseThrow(() -> new IllegalStateException("Identity references a missing user"));
      String incomingEmail = canonicalEmail(claims.email());
      String safeSnapshot =
          store
                  .findUserByCanonicalEmail(incomingEmail)
                  .filter(other -> !other.id().equals(user.id()))
                  .isPresent()
              ? identity.emailSnapshot()
              : incomingEmail;
      store.updateIdentityLogin(identity.id(), now, safeSnapshot);
      return user;
    }

    String email = canonicalEmail(claims.email());
    if (store.findUserByCanonicalEmail(email).isPresent()) {
      throw new AccountLinkRequiredException();
    }

    String userId = identifiers.get();
    UserAccount user =
        new UserAccount(
            userId,
            email,
            claims.displayName(),
            claims.avatarUrl(),
            AccountStatus.ACTIVE,
            OnboardingStatus.PHONE_REQUIRED,
            null,
            PhoneStatus.NOT_PROVIDED,
            0,
            null,
            com.dike.identity.domain.VerificationEvidence.NONE,
            Set.of(),
            0,
            now,
            now,
            0);
    AuthIdentity identity =
        new AuthIdentity(
            identifiers.get(),
            AuthProvider.GOOGLE,
            claims.issuer(),
            claims.subject(),
            userId,
            email,
            true,
            now,
            now);

    try {
      UserAccount inserted = store.insertUser(user);
      store.insertIdentity(identity);
      return inserted;
    } catch (DuplicateKeyException exception) {
      throw new AccountLinkRequiredException();
    }
  }

  public UserAccount requireUser(String userId) {
    return store
        .findUserById(userId)
        .orElseThrow(() -> new IllegalStateException("Authenticated user does not exist"));
  }

  private String canonicalEmail(String email) {
    if (email == null || email.isBlank()) {
      throw new IllegalArgumentException("Google email is required");
    }
    return email.trim().toLowerCase(Locale.ROOT);
  }
}
