package com.dike.trust;

import java.time.Instant;
import java.util.Map;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("reports")
public record Report(
    @Id String id,
    String reporterId,
    TargetType targetType,
    String targetId,
    String contextBookingId,
    Reason reason,
    String note,
    Status status,
    Priority priority,
    String assignedTo,
    Map<String, String> evidenceSnapshot,
    String resolutionCode,
    String resolutionNote,
    Instant createdAt,
    Instant updatedAt,
    Instant resolvedAt,
    long version) {
  public enum TargetType {
    USER,
    POST,
    MESSAGE,
    TRIP,
    REVIEW
  }

  public enum Reason {
    SPAM,
    HARASSMENT,
    UNSAFE,
    MISLEADING,
    HATEFUL_CONTENT,
    PRIVACY,
    PAYMENT_DISAGREEMENT,
    OTHER
  }

  public enum Status {
    RECEIVED,
    TRIAGED,
    IN_REVIEW,
    RESOLVED,
    DISMISSED
  }

  public enum Priority {
    P0,
    P1,
    P2,
    P3
  }
}
