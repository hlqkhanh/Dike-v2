package com.dike.identity.infrastructure.mongo;

import com.dike.identity.domain.ConsentDecision;
import com.dike.identity.domain.ConsentType;
import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("consent_receipts")
record ConsentReceiptDocument(
    @Id String id,
    String userId,
    ConsentType consentType,
    String documentVersion,
    ConsentDecision decision,
    Instant occurredAt,
    String source,
    String locale,
    String correlationId,
    String supersedesReceiptId) {}
