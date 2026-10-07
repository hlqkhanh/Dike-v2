package com.dike.ride.domain;

import com.dike.ride.RideResources.Quote;
import java.time.Instant;

public record Proposal(
    String id,
    String postId,
    String intentId,
    String tripId,
    String passengerId,
    String driverId,
    String senderId,
    String recipientId,
    Direction direction,
    Status status,
    String reason,
    long postTermsVersion,
    Quote quote,
    Instant expiresAt,
    long version) {
  public enum Direction {
    PASSENGER_REQUEST,
    DRIVER_OFFER
  }

  public enum Status {
    PENDING,
    ACCEPTED,
    REJECTED,
    WITHDRAWN,
    EXPIRED
  }

  public boolean live(Instant now) {
    return status == Status.PENDING && now.isBefore(expiresAt);
  }

  public Proposal transition(Status next, String why) {
    return new Proposal(
        id,
        postId,
        intentId,
        tripId,
        passengerId,
        driverId,
        senderId,
        recipientId,
        direction,
        next,
        why,
        postTermsVersion,
        quote,
        expiresAt,
        version + 1);
  }
}
