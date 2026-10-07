package com.dike.messaging;

import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("messages")
record ChatMessage(
    @Id String id,
    String conversationId,
    String senderId,
    String clientMessageId,
    long sequence,
    String text,
    Instant createdAt,
    boolean hidden) {}
