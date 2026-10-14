package com.dike.identity.domain;

import java.time.Instant;
import java.time.LocalDate;

public record UserProfile(
    String userId,
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
