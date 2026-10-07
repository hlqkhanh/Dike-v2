package com.dike.ride.domain;

import com.dike.ride.RideResources.Quote;
import java.time.Instant;

public record Booking(
    String id,
    String proposalId,
    String postId,
    String intentId,
    String tripId,
    String passengerId,
    String driverId,
    Status status,
    Quote agreedTerms,
    String reason,
    boolean seatReleased,
    Instant updatedAt,
    long version) {
  public enum Status {
    CONFIRMED,
    DRIVER_ARRIVED,
    BOARDED,
    IN_PROGRESS,
    COMPLETED,
    CANCELLED,
    NO_SHOW,
    ENDED_EARLY
  }

  public enum Action {
    ARRIVE,
    BOARD,
    COMPLETE,
    CANCEL,
    NO_SHOW,
    END_EARLY
  }

  public boolean active() {
    return switch (status) {
      case CONFIRMED, DRIVER_ARRIVED, BOARDED, IN_PROGRESS -> true;
      default -> false;
    };
  }

  public boolean aboard() {
    return status == Status.BOARDED || status == Status.IN_PROGRESS;
  }

  public Booking transition(
      Action action, String actor, boolean tripStarted, String explanation, Instant now) {
    if (!actor.equals(driverId) && !actor.equals(passengerId))
      throw new IllegalStateException("NOT_PARTICIPANT");
    boolean driver = actor.equals(driverId);
    Status next;
    switch (action) {
      case ARRIVE -> {
        if (!driver || status != Status.CONFIRMED)
          throw new IllegalStateException("INVALID_TRANSITION");
        next = Status.DRIVER_ARRIVED;
      }
      case BOARD -> {
        if (!driver || (status != Status.CONFIRMED && status != Status.DRIVER_ARRIVED))
          throw new IllegalStateException("INVALID_TRANSITION");
        next = tripStarted ? Status.IN_PROGRESS : Status.BOARDED;
      }
      case COMPLETE -> {
        if (!driver || status != Status.IN_PROGRESS)
          throw new IllegalStateException("INVALID_TRANSITION");
        next = Status.COMPLETED;
      }
      case CANCEL -> {
        if (status != Status.CONFIRMED && status != Status.DRIVER_ARRIVED)
          throw new IllegalStateException("INVALID_TRANSITION");
        requireReason(explanation);
        next = Status.CANCELLED;
      }
      case NO_SHOW -> {
        if (!driver || (status != Status.CONFIRMED && status != Status.DRIVER_ARRIVED))
          throw new IllegalStateException("INVALID_TRANSITION");
        if (now.isBefore(agreedTerms.pickupAt().plusSeconds(600)))
          throw new IllegalStateException("NO_SHOW_TOO_EARLY");
        requireReason(explanation);
        next = Status.NO_SHOW;
      }
      case END_EARLY -> {
        if (!aboard()) throw new IllegalStateException("INVALID_TRANSITION");
        requireReason(explanation);
        next = Status.ENDED_EARLY;
      }
      default -> throw new IllegalStateException("INVALID_TRANSITION");
    }
    return new Booking(
        id,
        proposalId,
        postId,
        intentId,
        tripId,
        passengerId,
        driverId,
        next,
        agreedTerms,
        explanation,
        seatReleased,
        now,
        version + 1);
  }

  public Booking start(Instant now) {
    if (status != Status.BOARDED) return this;
    return new Booking(
        id,
        proposalId,
        postId,
        intentId,
        tripId,
        passengerId,
        driverId,
        Status.IN_PROGRESS,
        agreedTerms,
        reason,
        seatReleased,
        now,
        version + 1);
  }

  public Booking released() {
    return new Booking(
        id,
        proposalId,
        postId,
        intentId,
        tripId,
        passengerId,
        driverId,
        status,
        agreedTerms,
        reason,
        true,
        updatedAt,
        version);
  }

  private static void requireReason(String reason) {
    if (reason == null || reason.isBlank() || reason.length() > 500)
      throw new IllegalStateException("REASON_REQUIRED");
  }
}
