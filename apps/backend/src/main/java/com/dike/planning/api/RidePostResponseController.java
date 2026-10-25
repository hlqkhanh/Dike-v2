package com.dike.planning.api;

import com.dike.planning.application.PickupCompatibilityService;
import com.dike.planning.application.RidePostResponseService;
import io.swagger.v3.oas.annotations.Operation;
import java.security.Principal;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class RidePostResponseController {
  private final RidePostResponseService service;
  private final PickupCompatibilityService pickups;

  public RidePostResponseController(
      RidePostResponseService service, PickupCompatibilityService pickups) {
    this.service = service;
    this.pickups = pickups;
  }

  public record Decision(long version, String decision) {}

  public record Create(String message, String pickupCheckId) {}

  @PostMapping("/ride-posts/{postId}/pickup-checks")
  @Operation(operationId = "checkRidePostPickup")
  public PickupCompatibilityService.View check(
      Principal principal,
      @PathVariable String postId,
      @RequestBody PickupCompatibilityService.Input body) {
    return pickups.check(principal.getName(), postId, body);
  }

  @PostMapping("/ride-posts/{postId}/responses")
  RidePostResponseService.View create(
      Principal principal,
      @PathVariable String postId,
      @RequestBody(required = false) Create body) {
    return service.create(
        principal.getName(),
        postId,
        body == null ? null : body.message(),
        body == null ? null : body.pickupCheckId());
  }

  @GetMapping("/ride-posts/{postId}/responses")
  List<RidePostResponseService.View> list(Principal principal, @PathVariable String postId) {
    return service.list(principal.getName(), postId);
  }

  @GetMapping("/ride-post-responses/active")
  List<RidePostResponseService.View> active(Principal principal) {
    return service.active(principal.getName());
  }

  @GetMapping("/ride-post-responses")
  @Operation(operationId = "listRidePostResponseInbox")
  public RidePostResponseService.Page inbox(
      Principal principal,
      @RequestParam(defaultValue = "sent") String direction,
      @RequestParam(required = false) String cursor,
      @RequestParam(defaultValue = "20") int limit) {
    return service.inbox(principal.getName(), direction, cursor, limit);
  }

  @PostMapping("/ride-post-responses/{id}/decision")
  RidePostResponseService.View decide(
      Principal principal, @PathVariable String id, @RequestBody Decision body) {
    return service.decide(principal.getName(), id, body.version(), body.decision());
  }
}
