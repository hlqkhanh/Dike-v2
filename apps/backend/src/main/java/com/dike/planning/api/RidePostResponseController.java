package com.dike.planning.api;

import com.dike.planning.application.RidePostResponseService;
import java.security.Principal;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class RidePostResponseController {
  private final RidePostResponseService service;

  public RidePostResponseController(RidePostResponseService service) {
    this.service = service;
  }

  public record Decision(long version, String decision) {}

  public record Create(String message) {}

  @PostMapping("/ride-posts/{postId}/responses")
  RidePostResponseService.View create(
      Principal principal,
      @PathVariable String postId,
      @RequestBody(required = false) Create body) {
    return service.create(principal.getName(), postId, body == null ? null : body.message());
  }

  @GetMapping("/ride-posts/{postId}/responses")
  List<RidePostResponseService.View> list(Principal principal, @PathVariable String postId) {
    return service.list(principal.getName(), postId);
  }

  @PostMapping("/ride-post-responses/{id}/decision")
  RidePostResponseService.View decide(
      Principal principal, @PathVariable String id, @RequestBody Decision body) {
    return service.decide(principal.getName(), id, body.version(), body.decision());
  }
}
