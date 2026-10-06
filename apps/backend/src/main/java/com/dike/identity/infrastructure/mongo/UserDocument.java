package com.dike.identity.infrastructure.mongo;

import com.dike.identity.domain.AccountStatus;
import com.dike.identity.domain.OnboardingStatus;
import com.dike.identity.domain.PhoneStatus;
import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("users")
record UserDocument(
    @Id String id,
    String canonicalEmail,
    String displayName,
    String avatarUrl,
    AccountStatus accountStatus,
    OnboardingStatus onboardingStatus,
    String phoneCandidateE164,
    PhoneStatus phoneStatus,
    Instant createdAt,
    Instant updatedAt,
    @Version Long version) {}
