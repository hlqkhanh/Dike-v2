package com.dike.ride.domain;

import com.dike.ride.RideResources.Stop;
import java.time.Instant;
import java.util.List;

public record Trip(
    String id,
    String driverId,
    String vehicleId,
    String vehicleType,
    long vehicleVersion,
    Status status,
    int offeredSeats,
    int remainingSeats,
    String routeId,
    long routeVersion,
    long termsVersion,
    Instant departureAt,
    Instant arrivalAt,
    String originLabel,
    String destinationLabel,
    String visibility,
    String communityId,
    long contributionPerKm,
    long detourMeters,
    long detourSeconds,
    List<Stop> stops,
    long version) {
  public enum Status {
    DRAFT,
    OPEN,
    FULL,
    IN_PROGRESS,
    COMPLETED,
    CANCELLED,
    EXPIRED
  }

  public Trip {
    stops = List.copyOf(stops);
    if (offeredSeats < 1
        || remainingSeats < 0
        || remainingSeats > offeredSeats
        || (!arrivalAt.isAfter(departureAt))
        || contributionPerKm < 0
        || detourMeters < 0
        || detourSeconds < 0) throw new IllegalArgumentException("Invalid trip");
    if ("MOTORCYCLE".equals(vehicleType) && offeredSeats > 1)
      throw new IllegalArgumentException("Motorcycle allows one passenger");
  }

  public Trip status(Status next) {
    return copy(next, remainingSeats, routeVersion, stops);
  }

  public Trip reserve(List<Stop> nextStops) {
    if (status != Status.OPEN || remainingSeats < 1) throw new IllegalStateException("NO_SEATS");
    return copy(
        remainingSeats == 1 ? Status.FULL : Status.OPEN,
        remainingSeats - 1,
        routeVersion + 1,
        nextStops);
  }

  public Trip release(String bookingId) {
    if (remainingSeats >= offeredSeats) throw new IllegalStateException("INVALID_RELEASE");
    return copy(
        status == Status.FULL ? Status.OPEN : status,
        remainingSeats + 1,
        routeVersion + 1,
        stops.stream().filter(s -> !bookingId.equals(s.bookingId())).toList());
  }

  private Trip copy(Status next, int seats, long route, List<Stop> updated) {
    return new Trip(
        id,
        driverId,
        vehicleId,
        vehicleType,
        vehicleVersion,
        next,
        offeredSeats,
        seats,
        routeId,
        route,
        termsVersion,
        departureAt,
        arrivalAt,
        originLabel,
        destinationLabel,
        visibility,
        communityId,
        contributionPerKm,
        detourMeters,
        detourSeconds,
        updated,
        version + 1);
  }
}
