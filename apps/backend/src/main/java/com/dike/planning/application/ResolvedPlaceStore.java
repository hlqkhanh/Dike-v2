package com.dike.planning.application;

import com.dike.planning.domain.PlaceSnapshot;
import java.time.Duration;
import java.util.Optional;

public interface ResolvedPlaceStore {

  void save(String ownerUserId, String placeReference, PlaceSnapshot place, Duration ttl);

  Optional<PlaceSnapshot> find(String ownerUserId, String placeReference);
}
