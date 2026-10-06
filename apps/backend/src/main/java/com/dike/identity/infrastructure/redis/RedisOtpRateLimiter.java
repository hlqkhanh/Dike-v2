package com.dike.identity.infrastructure.redis;

import com.dike.identity.application.OtpRateLimiter;
import com.dike.identity.infrastructure.otp.OtpCodeProtector;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.springframework.core.env.Environment;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

@Component
class RedisOtpRateLimiter implements OtpRateLimiter {

  private static final DefaultRedisScript<Long> SCRIPT =
      new DefaultRedisScript<>(
          "for i,key in ipairs(KEYS) do local n=tonumber(redis.call('GET',key) or '0'); local lim=tonumber(ARGV[(i-1)*2+1]); if n>=lim then local ttl=redis.call('PTTL',key); if ttl<0 then ttl=1000 end; return ttl end end; for i,key in ipairs(KEYS) do local n=redis.call('INCR',key); if n==1 then redis.call('PEXPIRE',key,ARGV[(i-1)*2+2]) end end; return 0",
          Long.class);

  private final StringRedisTemplate redis;
  private final OtpCodeProtector protector;
  private final String prefix;

  RedisOtpRateLimiter(
      StringRedisTemplate redis, OtpCodeProtector protector, Environment environment) {
    this.redis = redis;
    this.protector = protector;
    this.prefix = "dike:" + environment.getProperty("dike.environment", "local") + ":otp:";
  }

  @Override
  public Decision reserveIssue(
      String userId, String phoneKey, String deviceSessionId, String clientIp) {
    return reserve(
        List.of(
            bucket("issue:user:1h", userId, 5, Duration.ofHours(1)),
            bucket("issue:user:24h", userId, 10, Duration.ofHours(24)),
            bucket("issue:phone:1h", phoneKey, 5, Duration.ofHours(1)),
            bucket("issue:phone:24h", phoneKey, 10, Duration.ofHours(24)),
            bucket("issue:device:1h", deviceSessionId, 5, Duration.ofHours(1)),
            bucket("issue:ip:1h", hash(clientIp), 20, Duration.ofHours(1)),
            bucket("issue:ip:24h", hash(clientIp), 100, Duration.ofHours(24))));
  }

  @Override
  public Decision reserveVerify(
      String userId, String phoneKey, String deviceSessionId, String clientIp) {
    Duration window = Duration.ofMinutes(15);
    return reserve(
        List.of(
            bucket("verify:user", userId, 20, window),
            bucket("verify:phone", phoneKey, 20, window),
            bucket("verify:device", deviceSessionId, 20, window),
            bucket("verify:ip", hash(clientIp), 100, window)));
  }

  private Decision reserve(List<Bucket> buckets) {
    List<String> keys = buckets.stream().map(Bucket::key).toList();
    List<String> arguments = new ArrayList<>();
    for (Bucket bucket : buckets) {
      arguments.add(Long.toString(bucket.limit()));
      arguments.add(Long.toString(bucket.window().toMillis()));
    }
    try {
      Long retryMillis = redis.execute(SCRIPT, keys, arguments.toArray());
      if (retryMillis == null) return new Decision(false, Duration.ofSeconds(1));
      return retryMillis == 0
          ? Decision.allowedDecision()
          : new Decision(false, Duration.ofMillis(retryMillis));
    } catch (RuntimeException unavailable) {
      return new Decision(false, Duration.ofSeconds(30));
    }
  }

  private Bucket bucket(String dimension, String value, long limit, Duration window) {
    return new Bucket(prefix + dimension + ":" + value, limit, window);
  }

  private String hash(String value) {
    return protector.phoneKey("ip\u001f" + value);
  }

  private record Bucket(String key, long limit, Duration window) {}
}
