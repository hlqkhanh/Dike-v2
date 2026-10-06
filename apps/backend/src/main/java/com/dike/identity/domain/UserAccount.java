package com.dike.identity.domain;

import java.time.Instant;

public record UserAccount(
    String id,
    String canonicalEmail,
    String displayName,
    String avatarUrl,
    AccountStatus accountStatus,
    OnboardingStatus onboardingStatus,
    String phoneCandidateE164,
    PhoneStatus phoneStatus,
    Instant createdAt,
    Instant updatedAt,
    long version) {}
