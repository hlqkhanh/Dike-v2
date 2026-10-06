package com.dike.identity.infrastructure.mongo;

import com.dike.identity.domain.AccountRole;
import com.dike.identity.domain.AccountStatus;
import com.dike.identity.domain.OnboardingStatus;
import com.dike.identity.domain.PhoneStatus;
import com.dike.identity.domain.VerificationEvidence;
import java.time.Instant;
import java.util.Set;
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
    String phoneE164,
    PhoneStatus phoneStatus,
    Long phoneVersion,
    Instant phoneVerifiedAt,
    VerificationEvidence verificationEvidence,
    Set<AccountRole> assignedRoles,
    Long authorizationVersion,
    Instant createdAt,
    Instant updatedAt,
    @Version Long version) {}
