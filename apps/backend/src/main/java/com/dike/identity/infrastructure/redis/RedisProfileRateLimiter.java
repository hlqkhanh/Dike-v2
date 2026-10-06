package com.dike.identity.infrastructure.redis;

import com.dike.identity.application.ProfileRateLimiter;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import org.springframework.core.env.Environment;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

@Component
class RedisProfileRateLimiter implements ProfileRateLimiter {
  private static final DefaultRedisScript<Long> SCRIPT =
      new DefaultRedisScript<>(
          "local n=redis.call('INCRBY',KEYS[1],ARGV[1]); if n==tonumber(ARGV[1]) then redis.call('PEXPIRE',KEYS[1],ARGV[2]) end; return n",
          Long.class);
  private final StringRedisTemplate redis;
  private final String environment;

  RedisProfileRateLimiter(StringRedisTemplate redis, Environment environment) {
    this.redis = redis;
    this.environment = environment.getProperty("dike.environment", "local");
  }

  @Override
  public boolean tryAcquire(
      String action, String userId, String clientAddress, long cost, long limit, Duration window) {
    return increment(action, "user", userId, cost, limit, window)
        && increment(action, "ip", clientAddress, cost, limit, window);
  }

  private boolean increment(
      String action, String dimension, String value, long cost, long limit, Duration window) {
    String key =
        "dike:"
            + environment
            + ":profile:"
            + action
            + ":"
            + dimension
            + ":"
            + hash(value == null ? "unknown" : value);
    Long current =
        redis.execute(
            SCRIPT, java.util.List.of(key), Long.toString(cost), Long.toString(window.toMillis()));
    return current != null && current <= limit;
  }

  private String hash(String value) {
    try {
      byte[] digest =
          MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(digest, 0, 12);
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 is required", exception);
    }
  }
}
