package com.dike.planning.api;

import com.dike.planning.application.PostService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import java.security.Principal;
import java.time.Instant;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
@SecurityRequirement(name = "sessionCookie")
public class PostController {
  private final PostService service;

  public PostController(PostService service) {
    this.service = service;
  }

  @io.swagger.v3.oas.annotations.media.Schema(name = "RideVersion")
  public record Version(long version) {}

  @PostMapping("/ride-posts")
  @Operation(operationId = "createRidePost")
  public PostService.View create(
      Principal p,
      @RequestBody PostService.Create body,
      @RequestHeader("Idempotency-Key") String key) {
    return service.create(p.getName(), body, key);
  }

  @PatchMapping("/ride-posts/{id}")
  @Operation(operationId = "editRidePost")
  public PostService.View edit(
      Principal p,
      @PathVariable String id,
      @RequestBody PostService.Edit body,
      @RequestHeader("Idempotency-Key") String key) {
    return service.edit(p.getName(), id, body, key);
  }

  @PostMapping("/ride-posts/{id}/publish")
  @Operation(operationId = "publishRidePost")
  public PostService.View publish(
      Principal p,
      @PathVariable String id,
      @RequestBody Version body,
      @RequestHeader("Idempotency-Key") String key) {
    return service.publish(p.getName(), id, body.version(), key);
  }

  @PostMapping("/ride-posts/{id}/close")
  @Operation(operationId = "closeRidePost")
  public PostService.View close(
      Principal p,
      @PathVariable String id,
      @RequestBody Version body,
      @RequestHeader("Idempotency-Key") String key) {
    return service.close(p.getName(), id, body.version(), key);
  }

  @GetMapping("/ride-posts/{id}")
  @Operation(operationId = "getRidePost")
  public PostService.View detail(Principal p, @PathVariable String id) {
    return service.detail(p.getName(), id);
  }

  @GetMapping("/ride-posts")
  @Operation(operationId = "listRidePosts")
  public PostService.Page feed(
      Principal p,
      @RequestParam(defaultValue = "latest") String tab,
      @RequestParam(required = false) String cursor,
      @RequestParam(defaultValue = "20") int limit,
      @RequestParam(required = false) String vehicle,
      @RequestParam(required = false) Instant from,
      @RequestParam(required = false) Instant until) {
    return service.feed(p.getName(), tab, cursor, limit, vehicle, from, until);
  }

  @GetMapping("/saved-posts")
  @Operation(operationId = "listSavedPosts")
  public PostService.Page saved(
      Principal p,
      @RequestParam(required = false) String cursor,
      @RequestParam(defaultValue = "20") int limit) {
    return service.saved(p.getName(), cursor, limit);
  }

  @PutMapping("/saved-posts/{id}")
  @Operation(operationId = "saveRidePost")
  public void save(Principal p, @PathVariable String id) {
    service.save(p.getName(), id, true);
  }

  @DeleteMapping("/saved-posts/{id}")
  @Operation(operationId = "unsaveRidePost")
  public void unsave(Principal p, @PathVariable String id) {
    service.save(p.getName(), id, false);
  }
}
