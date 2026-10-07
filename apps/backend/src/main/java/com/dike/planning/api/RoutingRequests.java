package com.dike.planning.api;

import com.dike.planning.domain.VehicleMode;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

final class RoutingRequests {

  private RoutingRequests() {}

  record ResolvePlace(
      @NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{8,100}") String sessionToken,
      @NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{8,100}") String placeRef) {}

  record CreateRoute(
      @NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{8,100}") String originPlaceRef,
      @NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{8,100}") String destinationPlaceRef,
      @NotNull VehicleMode vehicleMode) {}

  record CreateEstimate(
      @NotBlank @Pattern(regexp = "[A-Za-z0-9_-]{8,100}") String routeSnapshotId,
      @Min(1) long sharedDistanceMeters,
      @Min(0) @Max(7) int passengerSeats) {}
}
