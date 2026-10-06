package com.dike.identity.infrastructure.mongo;

import com.dike.identity.domain.OtpChallengeStatus;
import com.dike.identity.domain.OtpPurpose;
import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("otp_challenges")
public record OtpChallengeDocument(
    @Id String id,
    String userId,
    String deviceSessionId,
    long phoneVersion,
    String phoneKey,
    OtpPurpose purpose,
    long generation,
    OtpChallengeStatus status,
    byte[] codeMac,
    String keyVersion,
    int attemptsUsed,
    Instant expiresAt,
    Instant resendAfter,
    String requestKeyHash,
    Instant createdAt,
    Instant consumedAt,
    Instant purgeAt,
    String dispatchId,
    String providerReference,
    String errorCategory) {}
