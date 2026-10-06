package com.dike.identity.domain;

import java.time.Instant;

public record UserPrivacySettings(
    String userId,
    ProfileVisibility profileVisibility,
    boolean discoverableByName,
    boolean allowMessageRequests,
    Instant updatedAt,
    long version) {}
