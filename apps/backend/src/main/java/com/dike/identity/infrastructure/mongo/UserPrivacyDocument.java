package com.dike.identity.infrastructure.mongo;

import com.dike.identity.domain.ProfileVisibility;
import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("user_privacy_settings")
record UserPrivacyDocument(
    @Id String userId,
    ProfileVisibility profileVisibility,
    boolean discoverableByName,
    boolean allowMessageRequests,
    Instant updatedAt,
    long version) {}
