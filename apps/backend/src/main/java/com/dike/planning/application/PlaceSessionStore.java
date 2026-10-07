package com.dike.planning.application;

import java.time.Duration;
import java.util.Map;
import java.util.Optional;

public interface PlaceSessionStore {

  void create(String ownerUserId, String sessionToken, Duration ttl);

  boolean saveSuggestions(
      String ownerUserId, String sessionToken, Map<String, String> providerIdsByReference);

  Optional<String> consume(String ownerUserId, String sessionToken, String placeReference);
}
