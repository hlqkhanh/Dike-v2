package com.dike.identity.domain;

import java.time.Instant;

public record UserProfile(
    String userId,
    String displayName,
    String normalizedDisplayName,
    String bio,
    String avatarFileId,
    String avatarPublicUrl,
    Instant createdAt,
    Instant updatedAt,
    long version) {}
