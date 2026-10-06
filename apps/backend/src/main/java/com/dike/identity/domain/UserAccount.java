package com.dike.identity.domain;

import java.time.Instant;
import java.util.Set;

public record UserAccount(
    String id,
    String canonicalEmail,
    String displayName,
    String avatarUrl,
    AccountStatus accountStatus,
    OnboardingStatus onboardingStatus,
    String phoneE164,
    PhoneStatus phoneStatus,
    long phoneVersion,
    Instant phoneVerifiedAt,
    VerificationEvidence verificationEvidence,
    Set<AccountRole> assignedRoles,
    long authorizationVersion,
    Instant createdAt,
    Instant updatedAt,
    long version) {

  public UserAccount {
    assignedRoles = Set.copyOf(assignedRoles);
  }
}
