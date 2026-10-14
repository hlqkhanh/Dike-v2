package com.dike.messaging;

import java.time.Instant;

/** A snapshot of the public journey details shared in a conversation. */
public record RidePostAttachment(
    String postId,
    String type,
    String originLabel,
    String destinationLabel,
    Instant departureAt,
    String vehicleType,
    Integer remainingSeats,
    Long contributionPerKm) {}
