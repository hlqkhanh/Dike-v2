package com.dike.planning.api;

import com.dike.planning.JourneySources;
import com.dike.planning.application.PostSourceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import java.security.Principal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/ride-post-sources")
@SecurityRequirement(name = "sessionCookie")
public class PostSourceController {
  private final PostSourceService service;

  public PostSourceController(PostSourceService service) {
    this.service = service;
  }

  @GetMapping
  @Operation(operationId = "listPostSources")
  public PostSourceService.Choices list(Principal p) {
    return service.choices(p.getName());
  }

  @PostMapping
  @Operation(operationId = "createPostSource")
  public JourneySources.Intent create(
      Principal p,
      @RequestBody PostSourceService.Create body,
      @RequestHeader("Idempotency-Key") String key) {
    return service.create(p.getName(), body, key);
  }

  @PostMapping("/{id}/route")
  @Operation(operationId = "preparePostSource")
  public JourneySources.Intent bind(
      Principal p,
      @PathVariable String id,
      @RequestBody PostSourceService.Bind body,
      @RequestHeader("Idempotency-Key") String key) {
    return service.bind(p.getName(), id, body, key);
  }
}
