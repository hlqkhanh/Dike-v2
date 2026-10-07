package com.dike.ride.api;

import com.dike.ride.application.RideService;
import com.dike.ride.domain.Booking;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import java.security.Principal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
@SecurityRequirement(name = "sessionCookie")
public class RideController {
  private final RideService service;

  public RideController(RideService service) {
    this.service = service;
  }

  public record RideVersion(long version) {}

  public record TripAction(long version, String action, String reason) {}

  public record BookingAction(long version, Booking.Action action, String reason, String code) {}

  public record BoardingCode(String code) {}

  @PostMapping("/bookings/{id}/find-again")
  @Operation(operationId = "findRideAgain")
  public RideService.DraftAgain findAgain(
      Principal p,
      @PathVariable String id,
      @RequestBody RideVersion body,
      @RequestHeader("Idempotency-Key") String key) {
    return service.findAgain(p.getName(), id, body.version(), key);
  }

  @PostMapping("/trips")
  @Operation(operationId = "createTrip")
  public RideService.TripView create(
      Principal p,
      @RequestBody RideService.CreateTrip body,
      @RequestHeader("Idempotency-Key") String key) {
    return service.createTrip(p.getName(), body, key);
  }

  @GetMapping("/trips")
  @Operation(operationId = "listTrips")
  public RideService.TripPage trips(
      Principal p,
      @RequestParam(required = false) String cursor,
      @RequestParam(defaultValue = "20") int limit) {
    return service.trips(p.getName(), cursor, limit);
  }

  @GetMapping("/trips/{id}")
  @Operation(operationId = "getTrip")
  public RideService.TripView trip(Principal p, @PathVariable String id) {
    return service.trip(p.getName(), id);
  }

  @PostMapping("/trips/{id}/open")
  @Operation(operationId = "openTrip")
  public RideService.TripView open(
      Principal p,
      @PathVariable String id,
      @RequestBody RideVersion body,
      @RequestHeader("Idempotency-Key") String key) {
    return service.openTrip(p.getName(), id, body.version(), key);
  }

  @PostMapping("/trips/{id}/actions")
  @Operation(operationId = "transitionTrip")
  public RideService.TripView tripAction(
      Principal p,
      @PathVariable String id,
      @RequestBody TripAction body,
      @RequestHeader("Idempotency-Key") String key) {
    return service.tripAction(p.getName(), id, body.version(), body.action(), body.reason(), key);
  }

  @PostMapping("/proposals")
  @Operation(operationId = "createProposal")
  public RideService.ProposalView propose(
      Principal p,
      @RequestBody RideService.CreateProposal body,
      @RequestHeader("Idempotency-Key") String key) {
    return service.propose(p.getName(), body, key);
  }

  @GetMapping("/proposals")
  @Operation(operationId = "listProposals")
  public RideService.ProposalPage proposals(
      Principal p,
      @RequestParam(required = false) String cursor,
      @RequestParam(defaultValue = "20") int limit) {
    return service.proposals(p.getName(), cursor, limit);
  }

  @GetMapping("/proposals/{id}")
  @Operation(operationId = "getProposal")
  public RideService.ProposalView proposal(Principal p, @PathVariable String id) {
    return service.proposal(p.getName(), id);
  }

  @PostMapping("/proposals/{id}/accept")
  @Operation(operationId = "acceptProposal")
  public RideService.BookingView accept(
      Principal p,
      @PathVariable String id,
      @RequestBody RideVersion body,
      @RequestHeader("Idempotency-Key") String key) {
    return service.accept(p.getName(), id, body.version(), key);
  }

  @PostMapping("/proposals/{id}/reject")
  @Operation(operationId = "rejectProposal")
  public RideService.ProposalView reject(
      Principal p,
      @PathVariable String id,
      @RequestBody RideVersion body,
      @RequestHeader("Idempotency-Key") String key) {
    return service.decide(p.getName(), id, body.version(), false, key);
  }

  @PostMapping("/proposals/{id}/withdraw")
  @Operation(operationId = "withdrawProposal")
  public RideService.ProposalView withdraw(
      Principal p,
      @PathVariable String id,
      @RequestBody RideVersion body,
      @RequestHeader("Idempotency-Key") String key) {
    return service.decide(p.getName(), id, body.version(), true, key);
  }

  @GetMapping("/bookings")
  @Operation(operationId = "listBookings")
  public RideService.BookingPage bookings(
      Principal p,
      @RequestParam(required = false) String cursor,
      @RequestParam(defaultValue = "20") int limit) {
    return service.bookings(p.getName(), cursor, limit);
  }

  @GetMapping("/bookings/{id}")
  @Operation(operationId = "getBooking")
  public RideService.BookingView booking(Principal p, @PathVariable String id) {
    return service.booking(p.getName(), id);
  }

  @GetMapping("/bookings/{id}/boarding-code")
  @Operation(operationId = "getBoardingCode")
  public BoardingCode code(Principal p, @PathVariable String id) {
    return new BoardingCode(service.code(p.getName(), id));
  }

  @PostMapping("/bookings/{id}/actions")
  @Operation(operationId = "transitionBooking")
  public RideService.BookingView bookingAction(
      Principal p,
      @PathVariable String id,
      @RequestBody BookingAction body,
      @RequestHeader("Idempotency-Key") String key) {
    return service.bookingAction(
        p.getName(), id, body.version(), body.action(), body.reason(), body.code(), key);
  }
}
