package com.dike.identity.domain;

import java.time.Instant;

public record ConsentReceipt(
    String id,
    String userId,
    ConsentType consentType,
    String documentVersion,
    ConsentDecision decision,
    Instant occurredAt,
    String source,
    String locale,
    String correlationId,
    String supersedesReceiptId) {}
