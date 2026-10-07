package com.dike.shared.outbox;

import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("outbox_deliveries")
record OutboxDelivery(
    @Id String id,
    String eventId,
    String consumerName,
    OutboxDeliveryStatus status,
    int attempts,
    Instant updatedAt,
    Instant completedAt,
    String lastError) {}
