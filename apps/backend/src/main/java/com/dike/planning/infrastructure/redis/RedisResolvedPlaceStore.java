package com.dike.planning.infrastructure.redis;

import com.dike.planning.application.ResolvedPlaceStore;
import com.dike.planning.domain.PlaceSnapshot;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import org.springframework.core.env.Environment;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Component
class RedisResolvedPlaceStore implements ResolvedPlaceStore {

  private final StringRedisTemplate redis;
  private final String prefix;

  RedisResolvedPlaceStore(StringRedisTemplate redis, Environment environment) {
    this.redis = redis;
    this.prefix =
        "dike:" + environment.getProperty("dike.environment", "local") + ":routing:place:";
  }

  @Override
  public void save(String ownerUserId, String placeReference, PlaceSnapshot place, Duration ttl) {
    String key = key(placeReference);
    redis
        .opsForHash()
        .putAll(
            key,
            Map.of(
                "owner", ownerUserId,
                "provider", place.provider(),
                "providerPlaceId", place.providerPlaceId(),
                "displayLabel", place.displayLabel(),
                "publicAreaLabel", place.publicAreaLabel(),
                "longitude", Double.toString(place.longitude()),
                "latitude", Double.toString(place.latitude()),
                "resolvedAt", place.resolvedAt().toString()));
    redis.expire(key, ttl);
  }

  @Override
  public Optional<PlaceSnapshot> find(String ownerUserId, String placeReference) {
    Map<Object, Object> values = redis.opsForHash().entries(key(placeReference));
    if (!ownerUserId.equals(values.get("owner"))) return Optional.empty();
    try {
      return Optional.of(
          new PlaceSnapshot(
              required(values, "provider"),
              required(values, "providerPlaceId"),
              required(values, "displayLabel"),
              required(values, "publicAreaLabel"),
              Double.parseDouble(required(values, "longitude")),
              Double.parseDouble(required(values, "latitude")),
              Instant.parse(required(values, "resolvedAt"))));
    } catch (RuntimeException invalid) {
      return Optional.empty();
    }
  }

  private String required(Map<Object, Object> values, String field) {
    Object value = values.get(field);
    if (!(value instanceof String text) || text.isBlank()) {
      throw new IllegalArgumentException("Invalid resolved place");
    }
    return text;
  }

  private String key(String placeReference) {
    return prefix + placeReference;
  }
}
