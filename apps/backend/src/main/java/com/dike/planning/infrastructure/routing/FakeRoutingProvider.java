package com.dike.planning.infrastructure.routing;

import com.dike.planning.application.RoutingProvider;
import com.dike.planning.domain.PlaceSnapshot;
import com.dike.planning.domain.RoutePoint;
import com.dike.planning.domain.VehicleMode;
import java.time.Instant;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "dike.routing", name = "provider", havingValue = "fake")
class FakeRoutingProvider implements RoutingProvider {

  @Override
  public List<PlaceSuggestion> autocomplete(
      String query, String sessionToken, Double biasLatitude, Double biasLongitude) {
    String normalized = query == null ? "" : query.strip();
    if (normalized.length() < 2) return List.of();
    return List.of(
        new PlaceSuggestion(
            "fake:" + Integer.toUnsignedString(normalized.hashCode()),
            normalized,
            "Quận 1, Thành phố Hồ Chí Minh",
            normalized + ", Quận 1, Thành phố Hồ Chí Minh"));
  }

  @Override
  public PlaceSnapshot resolve(String providerPlaceId, String sessionToken, Instant resolvedAt) {
    int seed = Math.abs(providerPlaceId.hashCode() % 1000);
    return new PlaceSnapshot(
        "FAKE",
        providerPlaceId,
        "Địa điểm thử nghiệm",
        "Quận 1, Thành phố Hồ Chí Minh",
        106.69 + seed / 1_000_000d,
        10.77 + seed / 1_000_000d,
        resolvedAt);
  }

  @Override
  public PlaceSnapshot reverse(double latitude, double longitude, Instant resolvedAt) {
    return new PlaceSnapshot(
        "FAKE",
        "fake:" + latitude + ":" + longitude,
        "Địa điểm thử nghiệm",
        "Quận 1, Thành phố Hồ Chí Minh",
        longitude,
        latitude,
        resolvedAt);
  }

  @Override
  public RouteResult route(
      PlaceSnapshot origin, PlaceSnapshot destination, VehicleMode vehicleMode) {
    double lat = destination.latitude() - origin.latitude();
    double lng = destination.longitude() - origin.longitude();
    long distance = Math.max(1, Math.round(Math.hypot(lat, lng) * 111_000));
    long speed = vehicleMode == VehicleMode.CAR ? 35_000 : 28_000;
    long seconds = Math.max(1, Math.round(distance * 3600d / speed));
    return new RouteResult(
        "FAKE",
        null,
        distance,
        seconds,
        List.of(
            new RoutePoint(origin.longitude(), origin.latitude()),
            new RoutePoint(destination.longitude(), destination.latitude())));
  }
}
