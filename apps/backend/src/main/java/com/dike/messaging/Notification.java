package com.dike.messaging;

import java.time.Instant;
import java.util.Map;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("notifications")
record Notification(
    @Id String id,
    String userId,
    String type,
    String title,
    String body,
    Map<String, String> data,
    Instant createdAt,
    Instant readAt) {}
