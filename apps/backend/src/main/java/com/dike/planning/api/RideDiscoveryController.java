package com.dike.planning.api;

import com.dike.planning.application.RideDiscoveryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import java.security.Principal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/ride-discovery")
@SecurityRequirement(name = "sessionCookie")
public class RideDiscoveryController {
  private final RideDiscoveryService service;

  public RideDiscoveryController(RideDiscoveryService service) {
    this.service = service;
  }

  @PostMapping
  @Operation(operationId = "discoverRides")
  public RideDiscoveryService.Results search(
      Principal principal, @RequestBody RideDiscoveryService.Input input) {
    return service.search(principal.getName(), input);
  }
}
