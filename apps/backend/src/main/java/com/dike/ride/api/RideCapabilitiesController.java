package com.dike.ride.api;

import com.dike.ride.application.RideCapabilities;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import java.security.Principal;
import org.springframework.web.bind.annotation.*;

@RestController
@SecurityRequirement(name = "sessionCookie")
public class RideCapabilitiesController {
  private final RideCapabilities capabilities;

  public RideCapabilitiesController(RideCapabilities capabilities) {
    this.capabilities = capabilities;
  }

  @GetMapping("/api/v1/ride-capabilities")
  @Operation(operationId = "getRideCapabilities")
  public RideCapabilities.View get(Principal principal) {
    return capabilities.view(principal.getName());
  }
}
