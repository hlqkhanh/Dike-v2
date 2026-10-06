package com.dike.identity.domain;

import java.time.Instant;

public record AccountDeletionRequest(
    String id,
    String userId,
    AccountDeletionState state,
    Instant requestedAt,
    Instant executeAfter,
    Instant completedAt,
    String policyVersion,
    int attempts,
    String lastFailureCategory,
    long version) {}
