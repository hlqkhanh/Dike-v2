package com.dike.trust;

import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("reviews")
public record Review(
    @Id String id,
    String bookingId,
    String reviewerId,
    String revieweeId,
    Role revieweeRole,
    int stars,
    String comment,
    Instant submittedAt,
    Instant publishDeadline,
    Publication publicationStatus,
    Instant publishedAt,
    Moderation moderationStatus,
    Instant moderatedAt,
    String moderatedBy,
    String moderationReason,
    long version) {
  public enum Role {
    DRIVER,
    PASSENGER
  }

  public enum Publication {
    PENDING,
    PUBLISHED
  }

  public enum Moderation {
    VISIBLE,
    HIDDEN
  }
}
