package com.dike.identity.infrastructure.mongo;

import com.dike.identity.domain.AccountDeletionState;
import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("account_deletion_requests")
record AccountDeletionDocument(
    @Id String id,
    String userId,
    AccountDeletionState state,
    Instant requestedAt,
    Instant executeAfter,
    Instant completedAt,
    String policyVersion,
    int attempts,
    String lastFailureCategory,
    long version) {}
