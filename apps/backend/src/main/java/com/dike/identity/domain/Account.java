package com.dike.identity.domain;

import java.time.Instant;

public record Account(
    String id,
    String displayName,
    String email,
    String phoneE164,
    String phoneStatus,
    long sessionVersion,
    Instant createdAt,
    Instant updatedAt) {}
