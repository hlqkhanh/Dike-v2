package com.dike.planning.infrastructure.redis;

import com.dike.planning.application.RouteCache;
import com.dike.planning.application.RoutingProvider;
import com.dike.planning.domain.PlaceSnapshot;
import com.dike.planning.domain.RoutePoint;
import com.dike.planning.domain.VehicleMode;
import com.dike.planning.infrastructure.routing.RoutingProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.core.env.Environment;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Component
public class RedisRouteCache implements RouteCache {

  private static final ObjectMapper JSON = new ObjectMapper();
  private final StringRedisTemplate redis;
  private final String prefix;
  private final byte[] secret;

  public RedisRouteCache(
      StringRedisTemplate redis, Environment environment, RoutingProperties properties) {
    this.redis = redis;
    this.prefix =
        "dike:" + environment.getProperty("dike.environment", "local") + ":routing:route:";
    this.secret = properties.cacheKeySecret().getBytes(StandardCharsets.UTF_8);
  }

  @Override
  public Optional<RoutingProvider.RouteResult> find(
      PlaceSnapshot origin, PlaceSnapshot destination, VehicleMode mode) {
    String encoded = redis.opsForValue().get(key(origin, destination, mode));
    if (encoded == null) return Optional.empty();
    try {
      CachedRoute cached = JSON.readValue(encoded, CachedRoute.class);
      return Optional.of(
          new RoutingProvider.RouteResult(
              cached.provider(),
              cached.providerRouteId(),
              cached.distanceMeters(),
              cached.durationSeconds(),
              cached.geometry()));
    } catch (Exception invalid) {
      return Optional.empty();
    }
  }

  @Override
  public void put(
      PlaceSnapshot origin,
      PlaceSnapshot destination,
      VehicleMode mode,
      RoutingProvider.RouteResult route,
      Duration ttl) {
    try {
      redis
          .opsForValue()
          .set(
              key(origin, destination, mode),
              JSON.writeValueAsString(
                  new CachedRoute(
                      route.provider(),
                      route.providerRouteId(),
                      route.distanceMeters(),
                      route.durationSeconds(),
                      route.geometry())),
              ttl);
    } catch (com.fasterxml.jackson.core.JsonProcessingException impossible) {
      throw new IllegalStateException("Cannot encode route cache value", impossible);
    }
  }

  private String key(PlaceSnapshot origin, PlaceSnapshot destination, VehicleMode mode) {
    String canonical =
        mode
            + "|"
            + origin.provider()
            + "|"
            + origin.providerPlaceId()
            + "|"
            + origin.longitude()
            + "|"
            + origin.latitude()
            + "|"
            + destination.provider()
            + "|"
            + destination.providerPlaceId()
            + "|"
            + destination.longitude()
            + "|"
            + destination.latitude();
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(secret, "HmacSHA256"));
      return prefix
          + HexFormat.of()
              .formatHex(mac.doFinal(canonical.getBytes(StandardCharsets.UTF_8)), 0, 24);
    } catch (java.security.GeneralSecurityException unavailable) {
      throw new IllegalStateException("HmacSHA256 is required", unavailable);
    }
  }

  private record CachedRoute(
      String provider,
      String providerRouteId,
      long distanceMeters,
      long durationSeconds,
      List<RoutePoint> geometry) {}
}
