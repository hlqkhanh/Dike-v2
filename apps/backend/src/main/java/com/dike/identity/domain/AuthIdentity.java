package com.dike.identity.domain;

import java.time.Instant;

public record AuthIdentity(
    String id,
    AuthProvider provider,
    String issuer,
    String subject,
    String userId,
    String emailSnapshot,
    boolean emailVerified,
    Instant createdAt,
    Instant lastLoginAt) {}
