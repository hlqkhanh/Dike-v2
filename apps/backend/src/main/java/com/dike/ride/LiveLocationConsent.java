package com.dike.ride;

import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document("live_location_consents")
record LiveLocationConsent(
    @Id String id,
    String bookingId,
    String userId,
    Instant enabledAt,
    Instant disabledAt,
    Instant revokedAt,
    long version) {}
