package com.dike.identity.infrastructure.mongo;

import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("user_profiles")
record UserProfileDocument(
    @Id String userId,
    String displayName,
    String normalizedDisplayName,
    String bio,
    String avatarFileId,
    String avatarPublicUrl,
    Instant createdAt,
    Instant updatedAt,
    long version) {}
