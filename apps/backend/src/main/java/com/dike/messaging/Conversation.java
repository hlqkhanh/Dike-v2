package com.dike.messaging;

import java.time.Instant;
import java.util.List;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("conversations")
record Conversation(
    @Id String id,
    Type type,
    String pairKey,
    String bookingId,
    List<String> participantIds,
    State state,
    String requesterId,
    Instant createdAt,
    Instant lastMessageAt,
    String lastMessageId,
    long nextSequence,
    long version) {

  enum Type {
    DIRECT,
    BOOKING
  }

  enum State {
    REQUEST_PENDING,
    OPEN,
    REJECTED
  }

  boolean participant(String userId) {
    return participantIds.contains(userId);
  }

  String other(String userId) {
    return participantIds.stream().filter(id -> !id.equals(userId)).findFirst().orElseThrow();
  }
}
