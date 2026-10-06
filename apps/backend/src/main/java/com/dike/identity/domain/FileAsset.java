package com.dike.identity.domain;

import java.time.Instant;

public record FileAsset(
    String id,
    String ownerUserId,
    FilePurpose purpose,
    FileVisibility visibility,
    FileState state,
    String stagingLocator,
    String finalLocator,
    String declaredContentType,
    String detectedContentType,
    long declaredSize,
    Long actualSize,
    String checksumSha256,
    String etag,
    String rejectionCode,
    Instant uploadExpiresAt,
    Instant retentionUntil,
    Instant createdAt,
    Instant updatedAt,
    Instant readyAt,
    Instant deletedAt,
    long version) {}
