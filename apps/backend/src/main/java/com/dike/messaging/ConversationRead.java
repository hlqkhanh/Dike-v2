package com.dike.messaging;

import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("conversation_reads")
record ConversationRead(
    @Id String id,
    String conversationId,
    String userId,
    long lastReadSequence,
    Instant updatedAt) {}
