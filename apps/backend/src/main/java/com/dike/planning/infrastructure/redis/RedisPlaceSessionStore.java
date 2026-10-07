package com.dike.planning.infrastructure.redis;

import com.dike.planning.application.PlaceSessionStore;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.core.env.Environment;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

@Component
class RedisPlaceSessionStore implements PlaceSessionStore {

  private static final DefaultRedisScript<String> CONSUME =
      new DefaultRedisScript<>(
          "local owner=redis.call('HGET',KEYS[1],'owner'); if owner~=ARGV[1] then return nil end; if redis.call('HGET',KEYS[1],'used')=='1' then return nil end; local value=redis.call('HGET',KEYS[1],ARGV[2]); if not value then return nil end; redis.call('HSET',KEYS[1],'used','1'); return value",
          String.class);

  private final StringRedisTemplate redis;
  private final String prefix;

  RedisPlaceSessionStore(StringRedisTemplate redis, Environment environment) {
    this.redis = redis;
    this.prefix =
        "dike:" + environment.getProperty("dike.environment", "local") + ":routing:place-session:";
  }

  @Override
  public void create(String ownerUserId, String sessionToken, Duration ttl) {
    String key = key(sessionToken);
    redis.opsForHash().putAll(key, Map.of("owner", ownerUserId, "used", "0"));
    redis.expire(key, ttl);
  }

  @Override
  public boolean saveSuggestions(
      String ownerUserId, String sessionToken, Map<String, String> providerIdsByReference) {
    String key = key(sessionToken);
    Object owner = redis.opsForHash().get(key, "owner");
    Object used = redis.opsForHash().get(key, "used");
    if (!ownerUserId.equals(owner) || "1".equals(used)) return false;
    if (!providerIdsByReference.isEmpty()) {
      Map<String, String> values = new java.util.LinkedHashMap<>();
      providerIdsByReference.forEach(
          (reference, providerId) -> values.put("ref:" + reference, providerId));
      redis.opsForHash().putAll(key, values);
    }
    return true;
  }

  @Override
  public Optional<String> consume(String ownerUserId, String sessionToken, String placeReference) {
    List<String> arguments = new ArrayList<>();
    arguments.add(ownerUserId);
    arguments.add("ref:" + placeReference);
    return Optional.ofNullable(
        redis.execute(CONSUME, List.of(key(sessionToken)), arguments.toArray()));
  }

  private String key(String token) {
    return prefix + token;
  }
}
