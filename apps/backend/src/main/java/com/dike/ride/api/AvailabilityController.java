package com.dike.ride.api;

import com.dike.ride.AvailabilityService;
import com.dike.ride.application.RideService;
import java.security.Principal;
import java.util.List;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class AvailabilityController {

  private final AvailabilityService service;

  public AvailabilityController(AvailabilityService service) {
    this.service = service;
  }

  public record EnableAvailability(
      String tripId, Double latitude, Double longitude, Double accuracyMeters) {}

  public record LocationRequest(
      String clientLocationId,
      String source,
      double latitude,
      double longitude,
      double accuracyMeters) {}

  public record InstantProposal(String postId, String quoteId) {}

  @GetMapping("/availability/me")
  ResponseEntity<AvailabilityService.AvailabilityView> mine(Principal principal) {
    return noStore(service.mine(principal.getName()));
  }

  @PutMapping("/availability/me")
  ResponseEntity<AvailabilityService.AvailabilityView> enable(
      Principal principal, @RequestBody EnableAvailability body) {
    return noStore(
        service.enable(
            principal.getName(),
            body.tripId(),
            body.latitude(),
            body.longitude(),
            body.accuracyMeters()));
  }

  @DeleteMapping("/availability/me")
  void disable(Principal principal) {
    service.disable(principal.getName());
  }

  @PostMapping("/availability/me/heartbeat")
  ResponseEntity<AvailabilityService.AvailabilityView> heartbeat(Principal principal) {
    return noStore(service.heartbeat(principal.getName()));
  }

  @PutMapping("/availability/me/location")
  ResponseEntity<AvailabilityService.AvailabilityView> availabilityLocation(
      Principal principal, @RequestBody LocationRequest body) {
    return noStore(
        service.updateAvailabilityLocation(
            principal.getName(), body.latitude(), body.longitude(), body.accuracyMeters()));
  }

  @PostMapping("/availability/search")
  ResponseEntity<List<AvailabilityService.Candidate>> search(Principal principal) {
    return noStore(service.search(principal.getName()));
  }

  @PostMapping("/availability/{handle}/proposals")
  RideService.ProposalView propose(
      Principal principal,
      @PathVariable String handle,
      @RequestBody InstantProposal body,
      @RequestHeader("Idempotency-Key") String key) {
    return service.propose(principal.getName(), handle, body.postId(), body.quoteId(), key);
  }

  @GetMapping("/bookings/{id}/live-location")
  ResponseEntity<AvailabilityService.LiveLocationView> locations(
      Principal principal, @PathVariable String id) {
    return noStore(service.locations(principal.getName(), id));
  }

  @PutMapping("/bookings/{id}/live-location-consent")
  void consent(Principal principal, @PathVariable String id) {
    service.consent(principal.getName(), id, true);
  }

  @DeleteMapping("/bookings/{id}/live-location-consent")
  void revoke(Principal principal, @PathVariable String id) {
    service.consent(principal.getName(), id, false);
  }

  @PutMapping("/bookings/{id}/live-location")
  ResponseEntity<AvailabilityService.LocationView> location(
      Principal principal, @PathVariable String id, @RequestBody LocationRequest body) {
    return noStore(
        service.updateLiveLocation(
            principal.getName(),
            id,
            body.clientLocationId(),
            body.source(),
            body.latitude(),
            body.longitude(),
            body.accuracyMeters()));
  }

  private <T> ResponseEntity<T> noStore(T body) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
  }
}
