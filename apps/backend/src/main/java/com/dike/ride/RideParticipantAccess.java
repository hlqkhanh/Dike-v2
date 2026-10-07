package com.dike.ride;

import com.dike.ride.application.RideStore;
import java.time.Instant;
import java.util.Optional;
import org.springframework.stereotype.Service;

/** Public ride-module facade for participant-scoped integrations. */
@Service
public class RideParticipantAccess {

  private final RideStore store;

  public RideParticipantAccess(RideStore store) {
    this.store = store;
  }

  public Optional<BookingParticipants> booking(String bookingId) {
    return store
        .booking(bookingId)
        .map(
            booking ->
                new BookingParticipants(
                    booking.id(),
                    booking.tripId(),
                    booking.passengerId(),
                    booking.driverId(),
                    booking.status().name(),
                    booking.active(),
                    booking.aboard(),
                    booking.agreedTerms().priceVnd(),
                    booking.updatedAt(),
                    booking.version()));
  }

  public Optional<TripAvailability> trip(String tripId) {
    return store
        .trip(tripId)
        .map(
            trip ->
                new TripAvailability(
                    trip.id(),
                    trip.driverId(),
                    trip.status().name(),
                    trip.remainingSeats(),
                    trip.departureAt(),
                    trip.version()));
  }

  public record BookingParticipants(
      String id,
      String tripId,
      String passengerId,
      String driverId,
      String status,
      boolean active,
      boolean aboard,
      long agreedPriceVnd,
      Instant updatedAt,
      long version) {
    public boolean participant(String userId) {
      return passengerId.equals(userId) || driverId.equals(userId);
    }

    public String counterpart(String userId) {
      if (passengerId.equals(userId)) return driverId;
      if (driverId.equals(userId)) return passengerId;
      throw new IllegalArgumentException("Not a booking participant");
    }
  }

  public record TripAvailability(
      String id,
      String driverId,
      String status,
      int remainingSeats,
      Instant departureAt,
      long version) {}
}
