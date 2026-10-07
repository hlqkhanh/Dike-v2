package com.dike.planning.application;

import com.dike.planning.domain.PlaceSnapshot;
import com.dike.planning.domain.VehicleMode;
import java.time.Duration;
import java.util.Optional;

public interface RouteCache {

  Optional<RoutingProvider.RouteResult> find(
      PlaceSnapshot origin, PlaceSnapshot destination, VehicleMode mode);

  void put(
      PlaceSnapshot origin,
      PlaceSnapshot destination,
      VehicleMode mode,
      RoutingProvider.RouteResult route,
      Duration ttl);
}
