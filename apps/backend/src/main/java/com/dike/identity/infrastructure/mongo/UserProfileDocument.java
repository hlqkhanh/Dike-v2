package com.dike.identity.infrastructure.mongo;

import java.time.Instant;
import java.time.LocalDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("user_profiles")
record UserProfileDocument(
    @Id String userId,
    String displayName,
    String normalizedDisplayName,
    String bio,
    LocalDate dateOfBirth,
    String provinceCode,
    String provinceName,
    String localityCode,
    String localityName,
    String facebookUrl,
    String avatarFileId,
    String avatarPublicUrl,
    Instant createdAt,
    Instant updatedAt,
    long version) {}
