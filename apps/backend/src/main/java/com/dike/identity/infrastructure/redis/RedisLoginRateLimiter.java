package com.dike.identity.infrastructure.redis;

import com.dike.identity.application.LoginRateLimiter;
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
class RedisLoginRateLimiter implements LoginRateLimiter {

  private static final DefaultRedisScript<Long> SCRIPT =
      new DefaultRedisScript<>(
          "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end; return n",
          Long.class);
  private static final long LOGIN_LIMIT = 10;
  private static final long FAILURE_LIMIT = 20;
  private static final Duration WINDOW = Duration.ofMinutes(10);
  private final StringRedisTemplate redis;
  private final String environment;

  RedisLoginRateLimiter(StringRedisTemplate redis, Environment environment) {
    this.redis = redis;
    this.environment = environment.getProperty("dike.environment", "local");
  }

  @Override
  public boolean tryAcquireLogin(String clientAddress) {
    return tryAcquire("login", clientAddress, LOGIN_LIMIT);
  }

  @Override
  public boolean tryAcquireFailure(String clientAddress) {
    return tryAcquire("failure", clientAddress, FAILURE_LIMIT);
  }

  private boolean tryAcquire(String bucket, String clientAddress, long limit) {
    String key = "dike:" + environment + ":auth:" + bucket + ":" + hash(clientAddress);
    Long count = redis.execute(SCRIPT, java.util.List.of(key), Long.toString(WINDOW.toMillis()));
    return count != null && count <= limit;
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
