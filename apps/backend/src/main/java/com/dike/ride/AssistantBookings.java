package com.dike.ride;

import com.dike.ride.application.RideService;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;

/** Minimal read model; no private locations, boarding codes or payment credentials. */
@Service
public class AssistantBookings {
  private final RideService rides;

  public AssistantBookings(RideService rides) {
    this.rides = rides;
  }

  @io.swagger.v3.oas.annotations.media.Schema(name = "AssistantBookingCard")
  public record Card(
      String id,
      String status,
      @io.swagger.v3.oas.annotations.media.Schema(nullable = true) Instant pickupAt,
      String role) {}

  public List<Card> mine(String actor) {
    return rides.bookings(actor, null, 20).items().stream()
        .map(
            b ->
                new Card(
                    b.id(),
                    b.status(),
                    b.pickupAt(),
                    actor.equals(b.driverId()) ? "DRIVER" : "RIDER"))
        .toList();
  }
}
