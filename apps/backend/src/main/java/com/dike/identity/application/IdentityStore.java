package com.dike.identity.application;

import com.dike.identity.domain.AuthIdentity;
import com.dike.identity.domain.UserAccount;
import java.time.Instant;
import java.util.Optional;

public interface IdentityStore {

  Optional<AuthIdentity> findIdentity(String issuer, String subject);

  Optional<UserAccount> findUserById(String userId);

  Optional<UserAccount> findUserByCanonicalEmail(String canonicalEmail);

  UserAccount insertUser(UserAccount user);

  void insertIdentity(AuthIdentity identity);

  void updateIdentityLogin(String identityId, Instant lastLoginAt, String emailSnapshot);

  UserAccount updatePhoneCandidate(
      String userId, long expectedPhoneVersion, String phoneE164, Instant updatedAt);
}
