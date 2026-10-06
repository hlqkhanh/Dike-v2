package com.dike.identity.infrastructure.mongo;

import com.dike.identity.domain.AuthProvider;
import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("auth_identities")
record AuthIdentityDocument(
    @Id String id,
    AuthProvider provider,
    String issuer,
    String subject,
    String userId,
    String emailSnapshot,
    boolean emailVerified,
    Instant createdAt,
    Instant lastLoginAt) {}
