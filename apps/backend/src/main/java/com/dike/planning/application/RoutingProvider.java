package com.dike.planning.application;

import com.dike.planning.domain.PlaceSnapshot;
import com.dike.planning.domain.RoutePoint;
import com.dike.planning.domain.VehicleMode;
import java.time.Instant;
import java.util.List;

public interface RoutingProvider {

  List<PlaceSuggestion> autocomplete(
      String query, String sessionToken, Double biasLatitude, Double biasLongitude);

  PlaceSnapshot resolve(String providerPlaceId, String sessionToken, Instant resolvedAt);

  PlaceSnapshot reverse(double latitude, double longitude, Instant resolvedAt);

  RouteResult route(PlaceSnapshot origin, PlaceSnapshot destination, VehicleMode vehicleMode);

  record PlaceSuggestion(
      String providerPlaceId, String mainText, String secondaryText, String displayLabel) {}

  record RouteResult(
      String provider,
      String providerRouteId,
      long distanceMeters,
      long durationSeconds,
      List<RoutePoint> geometry) {
    public RouteResult {
      geometry = List.copyOf(geometry);
      if (distanceMeters < 0 || durationSeconds < 0 || geometry.isEmpty()) {
        throw new IllegalArgumentException("Route result is incomplete");
      }
    }
  }
}
