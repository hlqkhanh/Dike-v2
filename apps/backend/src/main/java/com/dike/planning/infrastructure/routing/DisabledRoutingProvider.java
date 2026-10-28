package com.dike.planning.infrastructure.routing;

import com.dike.planning.application.RoutingProvider;
import com.dike.planning.application.RoutingProviderException;
import com.dike.planning.domain.PlaceSnapshot;
import com.dike.planning.domain.VehicleMode;
import java.time.Instant;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "dike.routing", name = "provider", havingValue = "disabled")
final class DisabledRoutingProvider implements RoutingProvider {
  @Override
  public List<PlaceSuggestion> autocomplete(
      String query, String sessionToken, Double biasLatitude, Double biasLongitude) {
    throw unavailable();
  }

  @Override
  public PlaceSnapshot resolve(String providerPlaceId, String sessionToken, Instant resolvedAt) {
    throw unavailable();
  }

  @Override
  public RouteResult route(
      PlaceSnapshot origin, PlaceSnapshot destination, VehicleMode vehicleMode) {
    throw unavailable();
  }

  @Override
  public PlaceSnapshot reverse(double latitude, double longitude, Instant resolvedAt) {
    throw unavailable();
  }

  private RoutingProviderException unavailable() {
    return new RoutingProviderException("ROUTING_UNAVAILABLE", "Routing is disabled in this demo");
  }
}
