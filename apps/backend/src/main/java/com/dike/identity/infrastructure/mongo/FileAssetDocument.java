package com.dike.identity.infrastructure.mongo;

import com.dike.identity.domain.FilePurpose;
import com.dike.identity.domain.FileState;
import com.dike.identity.domain.FileVisibility;
import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("file_assets")
record FileAssetDocument(
    @Id String id,
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
