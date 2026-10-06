package com.dike.identity.infrastructure.redis;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.dike.identity.infrastructure.otp.OtpCodeProtector;
import com.dike.identity.infrastructure.otp.OtpProperties;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.mock.env.MockEnvironment;

class RedisOtpRateLimiterTest {

  @Test
  void atomicallyReservesAllDimensionsAndReturnsTheBlockingTtl() {
    StringRedisTemplate redis = mock(StringRedisTemplate.class);
    when(redis.execute(any(), anyList(), any(Object[].class))).thenReturn(0L, 42_000L);
    RedisOtpRateLimiter limiter = limiter(redis);

    assertThat(limiter.reserveIssue("user", "phone-key", "device", "127.0.0.1").allowed()).isTrue();
    var blocked = limiter.reserveVerify("user", "phone-key", "device", "127.0.0.1");
    assertThat(blocked.allowed()).isFalse();
    assertThat(blocked.retryAfter()).isEqualTo(Duration.ofSeconds(42));
  }

  @Test
  void failsClosedWhenRedisIsUnavailable() {
    StringRedisTemplate redis = mock(StringRedisTemplate.class);
    when(redis.execute(any(), anyList(), any(Object[].class)))
        .thenThrow(new IllegalStateException("redis down"));

    assertThat(limiter(redis).reserveIssue("user", "phone-key", "device", "ip").allowed())
        .isFalse();
  }

  private RedisOtpRateLimiter limiter(StringRedisTemplate redis) {
    OtpProperties properties =
        new OtpProperties(
            "fake",
            "test-code-secret-with-enough-entropy",
            "test-rate-secret-with-enough-entropy",
            "test-v1",
            Duration.ofMinutes(5),
            Duration.ofMinutes(1),
            5,
            true,
            100);
    return new RedisOtpRateLimiter(
        redis,
        new OtpCodeProtector(properties),
        new MockEnvironment().withProperty("dike.environment", "test"));
  }
}
