package com.dike.trust;

import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("rating_summaries")
public record RatingSummary(
    @Id String id,
    String userId,
    Review.Role role,
    long sumStars,
    long reviewCount,
    Double average,
    long sourceRevision,
    Instant updatedAt) {}
