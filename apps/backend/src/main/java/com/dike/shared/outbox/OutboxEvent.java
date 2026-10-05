package com.dike.shared.outbox;

import java.time.Instant;
import java.util.Map;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("outbox_events")
public record OutboxEvent(
    @Id String eventId,
    String eventType,
    String aggregateType,
    String aggregateId,
    int payloadVersion,
    Map<String, Object> payload,
    String correlationId,
    String causationId,
    OutboxStatus status,
    int attempts,
    Instant nextAttemptAt,
    Instant lockedUntil,
    String lockedBy,
    Instant createdAt,
    Instant completedAt,
    String lastError) {}
