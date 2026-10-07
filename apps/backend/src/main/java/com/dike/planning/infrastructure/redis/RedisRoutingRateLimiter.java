package com.dike.planning.infrastructure.redis;

import com.dike.planning.application.RoutingRateLimiter;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.List;
import org.springframework.core.env.Environment;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

@Component
class RedisRoutingRateLimiter implements RoutingRateLimiter {

  private static final DefaultRedisScript<Long> SCRIPT =
      new DefaultRedisScript<>(
          "for i,key in ipairs(KEYS) do local n=tonumber(redis.call('GET',key) or '0'); if n>=tonumber(ARGV[1]) then return 0 end end; for i,key in ipairs(KEYS) do local n=redis.call('INCR',key); if n==1 then redis.call('PEXPIRE',key,ARGV[2]) end end; return 1",
          Long.class);

  private final StringRedisTemplate redis;
  private final String prefix;

  RedisRoutingRateLimiter(StringRedisTemplate redis, Environment environment) {
    this.redis = redis;
    this.prefix = "dike:" + environment.getProperty("dike.environment", "local") + ":routing:";
  }

  @Override
  public boolean tryAcquire(
      String action, String userId, String clientAddress, long limit, Duration window) {
    try {
      Long allowed =
          redis.execute(
              SCRIPT,
              List.of(
                  prefix + action + ":user:" + hash(userId),
                  prefix
                      + action
                      + ":ip:"
                      + hash(clientAddress == null ? "unknown" : clientAddress)),
              Long.toString(limit),
              Long.toString(window.toMillis()));
      return allowed != null && allowed == 1;
    } catch (RuntimeException unavailable) {
      return false;
    }
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
