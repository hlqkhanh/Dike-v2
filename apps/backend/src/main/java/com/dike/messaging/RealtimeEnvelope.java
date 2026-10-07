package com.dike.messaging;

import java.time.Instant;
import java.util.Map;

public record RealtimeEnvelope(
    String eventId,
    String eventType,
    int payloadVersion,
    String recipientUserId,
    String destination,
    Map<String, Object> payload,
    Instant occurredAt) {}
